-- Migration 0007: Marketplace Security Hardening
-- VATAR LIFESTYLE BY SOFT
--
-- Forward-only hardening migration for `202611220006_marketplace.sql`.
-- Addresses all findings from the pre-execution security audit:
--   1. Dispute finalization immutability & order-state locking (admin_resolve_dispute)
--   2. Inventory reservation, overselling prevention & proportional NUMERIC pricing (create_marketplace_order)
--   3. Post-approval edit re-moderation & inventory floor protection (update_own_marketplace_listing)
--   4. Prevention of administrator self-approval on own listings (admin_moderate_listing)
--
-- Does NOT modify migrations 0001-0006, weaken RLS, or widen table grants.

-- =========================================================
-- 1. HARDEN admin_resolve_dispute()
-- =========================================================
-- Locks both the dispute row and its parent order row (`FOR UPDATE`),
-- refusing to overwrite already-resolved/dismissed disputes or mutate
-- orders that are no longer in `disputed` status.
CREATE OR REPLACE FUNCTION public.admin_resolve_dispute(
  p_dispute_id UUID,
  p_dispute_status TEXT,
  p_resolution_note TEXT,
  p_target_order_status TEXT
)
RETURNS public.marketplace_disputes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_dispute public.marketplace_disputes;
  v_order public.marketplace_orders;
  v_updated public.marketplace_disputes;
  v_clean_note TEXT := trim(COALESCE(p_resolution_note, ''));
BEGIN
  IF v_admin_id IS NULL OR NOT public.is_active_admin(v_admin_id) THEN
    RAISE EXCEPTION 'Unauthorized: active administrator role required.';
  END IF;

  IF p_dispute_status NOT IN ('resolved', 'dismissed') THEN
    RAISE EXCEPTION 'Dispute resolution status must be resolved or dismissed.';
  END IF;

  IF char_length(v_clean_note) < 5 THEN
    RAISE EXCEPTION 'A resolution note (at least 5 characters) is required.';
  END IF;

  IF p_target_order_status NOT IN ('buyer_confirmed', 'cancelled', 'rejected', 'in_progress') THEN
    RAISE EXCEPTION 'Invalid target order status after dispute resolution: %', p_target_order_status;
  END IF;

  -- Lock dispute row first to prevent concurrent/duplicate resolutions
  SELECT * INTO v_dispute
  FROM public.marketplace_disputes
  WHERE id = p_dispute_id
  FOR UPDATE;

  IF v_dispute.id IS NULL THEN
    RAISE EXCEPTION 'Dispute not found.';
  END IF;

  IF v_dispute.status NOT IN ('open', 'under_review') THEN
    RAISE EXCEPTION 'Dispute has already been finalized (current status: %).', v_dispute.status;
  END IF;

  -- Lock parent order row and verify it is currently disputed
  SELECT * INTO v_order
  FROM public.marketplace_orders
  WHERE id = v_dispute.order_id
  FOR UPDATE;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Associated marketplace order not found.';
  END IF;

  IF v_order.status <> 'disputed' THEN
    RAISE EXCEPTION 'Associated order is not in disputed status (current status: %).', v_order.status;
  END IF;

  UPDATE public.marketplace_disputes
  SET
    status = p_dispute_status,
    admin_resolution_note = v_clean_note,
    resolved_by = v_admin_id,
    resolved_at = now()
  WHERE id = p_dispute_id
  RETURNING * INTO v_updated;

  UPDATE public.marketplace_orders
  SET
    status = p_target_order_status,
    buyer_confirmed_at = CASE
      WHEN p_target_order_status = 'buyer_confirmed' AND buyer_confirmed_at IS NULL THEN now()
      ELSE buyer_confirmed_at
    END
  WHERE id = v_order.id;

  INSERT INTO public.marketplace_order_events (
    order_id, actor_id, event_type, event_description
  ) VALUES (
    v_order.id,
    v_admin_id,
    'dispute.' || p_dispute_status,
    'Administrator ' || p_dispute_status || ' dispute (order → ' || p_target_order_status || '): ' || v_clean_note
  );

  INSERT INTO public.audit_logs (
    actor_id, action, entity_type, entity_id, metadata
  ) VALUES (
    v_admin_id,
    'marketplace_dispute.' || p_dispute_status,
    'marketplace_dispute',
    v_updated.id,
    jsonb_build_object(
      'order_id', v_order.id,
      'previous_dispute_status', v_dispute.status,
      'new_dispute_status', p_dispute_status,
      'target_order_status', p_target_order_status,
      'resolution_note', v_clean_note
    )
  );

  RETURN v_updated;
END;
$$;

-- =========================================================
-- 2. HARDEN create_marketplace_order()
-- =========================================================
-- Enforces:
-- - Row-level lock (`FOR UPDATE`) on the target listing to serialize concurrent buyers.
-- - Safe inventory reservation for `lagos_life_funds` across all active, disputed,
--   and buyer_confirmed orders (excluding cancelled and rejected orders).
-- - Server-calculated proportional pricing using exact PostgreSQL NUMERIC arithmetic:
--     * Full quantity (`requested = listed`): exact `listing.price_amount` (zero rounding drift).
--     * Partial quantity (`0 < requested < listed`):
--         ROUND((listing.price_amount * requested::NUMERIC) / listing.game_currency_amount::NUMERIC, 2)
--       using PostgreSQL NUMERIC round-half-away-from-zero to 2 decimal places, rejecting
--       micro-requests that would round to <= 0.00.
-- - Buyers can never supply their own agreed price.
-- - Non-game-funds listings preserve exact listing price semantics.
CREATE OR REPLACE FUNCTION public.create_marketplace_order(
  p_listing_id UUID,
  p_requested_game_currency_amount BIGINT DEFAULT NULL,
  p_recipient_lagos_life_username TEXT DEFAULT NULL,
  p_buyer_note TEXT DEFAULT NULL
)
RETURNS public.marketplace_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_buyer_id UUID := auth.uid();
  v_listing public.marketplace_listings;
  v_recipient TEXT;
  v_requested_qty BIGINT;
  v_committed_qty BIGINT := 0;
  v_available_qty BIGINT;
  v_agreed_price NUMERIC(18, 2);
  v_created public.marketplace_orders;
BEGIN
  IF v_buyer_id IS NULL OR NOT public.is_approved_member(v_buyer_id) THEN
    RAISE EXCEPTION 'Only approved VATAR members may submit purchase requests.';
  END IF;

  -- Lock listing row to serialize concurrent inventory checks and reservations
  SELECT * INTO v_listing
  FROM public.marketplace_listings
  WHERE id = p_listing_id
  FOR UPDATE;

  IF v_listing.id IS NULL THEN
    RAISE EXCEPTION 'Listing not found.';
  END IF;

  IF v_listing.moderation_status <> 'approved' OR v_listing.status <> 'available' THEN
    RAISE EXCEPTION 'This listing is not currently available for purchase requests.';
  END IF;

  IF v_listing.seller_id = v_buyer_id THEN
    RAISE EXCEPTION 'You cannot submit a purchase request on your own listing.';
  END IF;

  v_recipient := NULLIF(trim(COALESCE(p_recipient_lagos_life_username, '')), '');

  IF v_listing.category = 'lagos_life_funds' THEN
    IF v_recipient IS NULL THEN
      RAISE EXCEPTION 'Recipient Lagos Life username is required for game-currency orders.';
    END IF;

    IF v_listing.game_currency_amount IS NULL OR v_listing.game_currency_amount <= 0 THEN
      RAISE EXCEPTION 'This game-funds listing has invalid inventory configured.';
    END IF;

    v_requested_qty := p_requested_game_currency_amount;
    IF v_requested_qty IS NULL OR v_requested_qty <= 0 THEN
      RAISE EXCEPTION 'A positive game-currency quantity is required for Lagos Life funds orders.';
    END IF;

    -- Sum all reserved (active + disputed) and consumed (buyer_confirmed) quantities;
    -- explicitly excludes cancelled and rejected orders.
    SELECT COALESCE(SUM(COALESCE(o.requested_game_currency_amount, 0)), 0)::BIGINT
    INTO v_committed_qty
    FROM public.marketplace_orders o
    WHERE o.listing_id = v_listing.id
      AND o.status IN (
        'requested',
        'accepted',
        'in_progress',
        'seller_marked_sent',
        'disputed',
        'buyer_confirmed'
      );

    v_available_qty := v_listing.game_currency_amount - v_committed_qty;

    IF v_available_qty <= 0 THEN
      RAISE EXCEPTION 'This listing has no remaining game-currency inventory available.';
    END IF;

    IF v_requested_qty > v_available_qty THEN
      RAISE EXCEPTION 'Requested quantity (%) exceeds remaining available inventory (%).',
        v_requested_qty, v_available_qty;
    END IF;

    -- Proportional server-side NUMERIC price calculation (round-half-away-from-zero to 2dp)
    IF v_requested_qty = v_listing.game_currency_amount THEN
      v_agreed_price := v_listing.price_amount;
    ELSE
      v_agreed_price := ROUND(
        (v_listing.price_amount * v_requested_qty::NUMERIC)
          / v_listing.game_currency_amount::NUMERIC,
        2
      );
      IF v_agreed_price <= 0 THEN
        RAISE EXCEPTION 'Requested quantity is too small to produce a valid order price.';
      END IF;
    END IF;
  ELSE
    -- Non-game-funds categories preserve fixed listing price semantics
    IF p_requested_game_currency_amount IS NOT NULL AND p_requested_game_currency_amount <= 0 THEN
      RAISE EXCEPTION 'Requested quantity must be positive when provided.';
    END IF;
    v_requested_qty := COALESCE(p_requested_game_currency_amount, v_listing.game_currency_amount);
    v_agreed_price := v_listing.price_amount;
  END IF;

  INSERT INTO public.marketplace_orders (
    listing_id,
    buyer_id,
    seller_id,
    requested_game_currency_amount,
    agreed_price_amount,
    agreed_price_currency,
    recipient_lagos_life_username,
    fulfillment_mode,
    status,
    buyer_note
  )
  VALUES (
    v_listing.id,
    v_buyer_id,
    v_listing.seller_id,
    v_requested_qty,
    v_agreed_price,
    v_listing.price_currency,
    v_recipient,
    'manual',
    'requested',
    NULLIF(trim(COALESCE(p_buyer_note, '')), '')
  )
  RETURNING * INTO v_created;

  INSERT INTO public.marketplace_order_events (
    order_id, actor_id, event_type, event_description
  ) VALUES (
    v_created.id,
    v_buyer_id,
    'order.requested',
    'Buyer submitted a manual fulfilment purchase request (' || v_agreed_price::TEXT || ' ' || v_listing.price_currency || ').'
  );

  RETURN v_created;
END;
$$;

-- =========================================================
-- 3. HARDEN update_own_marketplace_listing()
-- =========================================================
-- Enforces:
-- - Full server-side validation on all fields (including game_currency_amount > 0 for lagos_life_funds).
-- - Prevents reducing game_currency_amount below already reserved + consumed order quantities.
-- - Resets moderation_status to 'pending' whenever content, price, quantity, or contact note
--   changes on an already-approved listing (preserving existing moderation history columns).
-- - Allows pure availability status toggles (`available` / `unavailable` / `sold`) without
--   triggering unnecessary re-moderation.
CREATE OR REPLACE FUNCTION public.update_own_marketplace_listing(
  p_listing_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_price_amount NUMERIC,
  p_price_currency TEXT DEFAULT 'NGN',
  p_game_currency_amount BIGINT DEFAULT NULL,
  p_seller_contact_note TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'available'
)
RETURNS public.marketplace_listings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_existing public.marketplace_listings;
  v_updated public.marketplace_listings;
  v_clean_title TEXT := trim(COALESCE(p_title, ''));
  v_clean_desc TEXT := trim(COALESCE(p_description, ''));
  v_clean_currency TEXT := upper(trim(COALESCE(p_price_currency, 'NGN')));
  v_clean_contact TEXT := NULLIF(trim(COALESCE(p_seller_contact_note, '')), '');
  v_committed_qty BIGINT := 0;
  v_content_changed BOOLEAN := FALSE;
  v_next_moderation TEXT;
BEGIN
  IF v_user_id IS NULL OR NOT public.is_approved_member(v_user_id) THEN
    RAISE EXCEPTION 'Only approved VATAR members may update listings.';
  END IF;

  IF char_length(v_clean_title) < 4 OR char_length(v_clean_title) > 120 THEN
    RAISE EXCEPTION 'Listing title must be between 4 and 120 characters.';
  END IF;

  IF char_length(v_clean_desc) < 10 OR char_length(v_clean_desc) > 2000 THEN
    RAISE EXCEPTION 'Listing description must be between 10 and 2000 characters.';
  END IF;

  IF p_price_amount IS NULL OR p_price_amount <= 0 THEN
    RAISE EXCEPTION 'Asking price must be greater than 0.';
  END IF;

  IF char_length(v_clean_currency) < 2 OR char_length(v_clean_currency) > 10 THEN
    RAISE EXCEPTION 'Price currency must be between 2 and 10 characters.';
  END IF;

  IF p_status NOT IN ('available', 'unavailable', 'sold') THEN
    RAISE EXCEPTION 'Invalid listing status: %', p_status;
  END IF;

  -- Lock listing row to prevent races with concurrent orders
  SELECT * INTO v_existing
  FROM public.marketplace_listings
  WHERE id = p_listing_id
  FOR UPDATE;

  IF v_existing.id IS NULL THEN
    RAISE EXCEPTION 'Listing not found.';
  END IF;

  IF v_existing.seller_id <> v_user_id THEN
    RAISE EXCEPTION 'You may only edit your own listings.';
  END IF;

  IF v_existing.moderation_status IN ('rejected', 'removed') THEN
    RAISE EXCEPTION 'Listings with moderation status "%" cannot be edited.', v_existing.moderation_status;
  END IF;

  IF v_existing.category = 'lagos_life_funds' THEN
    IF p_game_currency_amount IS NULL OR p_game_currency_amount <= 0 THEN
      RAISE EXCEPTION 'Lagos Life game funds listings must specify a positive game currency amount.';
    END IF;

    -- Prevent reducing inventory below already reserved or confirmed quantities
    SELECT COALESCE(SUM(COALESCE(o.requested_game_currency_amount, 0)), 0)::BIGINT
    INTO v_committed_qty
    FROM public.marketplace_orders o
    WHERE o.listing_id = v_existing.id
      AND o.status IN (
        'requested',
        'accepted',
        'in_progress',
        'seller_marked_sent',
        'disputed',
        'buyer_confirmed'
      );

    IF p_game_currency_amount < v_committed_qty THEN
      RAISE EXCEPTION 'Cannot reduce game-currency quantity (%) below already reserved/completed order volume (%).',
        p_game_currency_amount, v_committed_qty;
    END IF;
  ELSIF p_game_currency_amount IS NOT NULL AND p_game_currency_amount <= 0 THEN
    RAISE EXCEPTION 'Game currency amount must be positive when provided.';
  END IF;

  v_content_changed :=
    (v_clean_title IS DISTINCT FROM v_existing.title)
    OR (v_clean_desc IS DISTINCT FROM v_existing.description)
    OR (p_price_amount IS DISTINCT FROM v_existing.price_amount)
    OR (v_clean_currency IS DISTINCT FROM v_existing.price_currency)
    OR (p_game_currency_amount IS DISTINCT FROM v_existing.game_currency_amount)
    OR (v_clean_contact IS DISTINCT FROM v_existing.seller_contact_note);

  -- Reset approved listings to pending moderation when substantive fields change,
  -- while preserving previous moderation metadata history until the next review.
  IF v_existing.moderation_status = 'approved' AND v_content_changed THEN
    v_next_moderation := 'pending';
  ELSE
    v_next_moderation := v_existing.moderation_status;
  END IF;

  UPDATE public.marketplace_listings
  SET
    title = v_clean_title,
    description = v_clean_desc,
    price_amount = p_price_amount,
    price_currency = v_clean_currency,
    game_currency_amount = p_game_currency_amount,
    seller_contact_note = v_clean_contact,
    status = p_status,
    moderation_status = v_next_moderation
  WHERE id = p_listing_id
  RETURNING * INTO v_updated;

  RETURN v_updated;
END;
$$;

-- =========================================================
-- 4. HARDEN admin_moderate_listing()
-- =========================================================
-- Blocks both admin and super_admin from approving their own marketplace listings,
-- preserving separation of duties while allowing moderation of other members' listings.
CREATE OR REPLACE FUNCTION public.admin_moderate_listing(
  p_listing_id UUID,
  p_moderation_status TEXT,
  p_moderation_note TEXT DEFAULT NULL
)
RETURNS public.marketplace_listings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_existing public.marketplace_listings;
  v_updated public.marketplace_listings;
BEGIN
  IF v_admin_id IS NULL OR NOT public.is_active_admin(v_admin_id) THEN
    RAISE EXCEPTION 'Unauthorized: active administrator role required.';
  END IF;

  IF p_moderation_status NOT IN ('pending', 'approved', 'rejected', 'removed') THEN
    RAISE EXCEPTION 'Invalid moderation status: %', p_moderation_status;
  END IF;

  SELECT * INTO v_existing
  FROM public.marketplace_listings
  WHERE id = p_listing_id
  FOR UPDATE;

  IF v_existing.id IS NULL THEN
    RAISE EXCEPTION 'Listing not found.';
  END IF;

  -- Prevent self-approval by any administrator (including super_admin)
  IF p_moderation_status = 'approved' AND v_existing.seller_id = v_admin_id THEN
    RAISE EXCEPTION 'Unauthorized: administrators cannot approve their own marketplace listings.';
  END IF;

  UPDATE public.marketplace_listings
  SET
    moderation_status = p_moderation_status,
    moderation_note = NULLIF(trim(COALESCE(p_moderation_note, '')), ''),
    moderated_by = v_admin_id,
    moderated_at = now(),
    status = CASE
      WHEN p_moderation_status IN ('rejected', 'removed') THEN 'unavailable'
      ELSE status
    END
  WHERE id = p_listing_id
  RETURNING * INTO v_updated;

  INSERT INTO public.audit_logs (
    actor_id, action, entity_type, entity_id, target_user_id, metadata
  ) VALUES (
    v_admin_id,
    'marketplace_listing.moderated',
    'marketplace_listing',
    v_updated.id,
    v_updated.seller_id,
    jsonb_build_object(
      'title', v_updated.title,
      'previous_status', v_existing.moderation_status,
      'new_status', v_updated.moderation_status,
      'note', v_updated.moderation_note
    )
  );

  RETURN v_updated;
END;
$$;

-- Re-assert least-privilege EXECUTE grants on all four hardened functions
REVOKE ALL ON FUNCTION public.admin_resolve_dispute(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_resolve_dispute(UUID, TEXT, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.create_marketplace_order(UUID, BIGINT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_marketplace_order(UUID, BIGINT, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.update_own_marketplace_listing(UUID, TEXT, TEXT, NUMERIC, TEXT, BIGINT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_own_marketplace_listing(UUID, TEXT, TEXT, NUMERIC, TEXT, BIGINT, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_moderate_listing(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_moderate_listing(UUID, TEXT, TEXT) TO authenticated;
