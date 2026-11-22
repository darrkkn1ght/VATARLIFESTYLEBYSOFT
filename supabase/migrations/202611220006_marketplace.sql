-- Migration 0006: VATAR Marketplace, Manual Order Fulfilment, Disputes & Event Ledger
-- VATAR LIFESTYLE BY SOFT — Milestone 7
--
-- Security & Architecture:
-- - Manual seller fulfilment only (`fulfillment_mode = 'manual'`). Extensible for a future
--   officially authorized API (`'official_api'`), without connecting any unofficial endpoints.
-- - VATAR never collects or stores game passwords, OTPs, PINs, or session cookies.
-- - All state-changing operations execute exclusively through hardened SECURITY DEFINER RPCs
--   with fixed search_path, strict role/ownership checks, and immutable event/audit logging.

-- =========================================================
-- 1. MARKETPLACE LISTINGS TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS public.marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price_amount NUMERIC(18, 2) NOT NULL,
  price_currency TEXT NOT NULL DEFAULT 'NGN',
  game_currency_amount BIGINT,
  seller_contact_note TEXT,
  status TEXT NOT NULL DEFAULT 'available',
  moderation_status TEXT NOT NULL DEFAULT 'pending',
  moderation_note TEXT,
  moderated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  moderated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_listings_category_check CHECK (
    category IN (
      'lagos_life_funds',
      'digital_goods',
      'digital_services',
      'community_products'
    )
  ),
  CONSTRAINT marketplace_listings_title_length CHECK (
    char_length(trim(title)) BETWEEN 4 AND 120
  ),
  CONSTRAINT marketplace_listings_description_length CHECK (
    char_length(trim(description)) BETWEEN 10 AND 2000
  ),
  CONSTRAINT marketplace_listings_price_positive CHECK (price_amount > 0),
  CONSTRAINT marketplace_listings_currency_length CHECK (
    char_length(trim(price_currency)) BETWEEN 2 AND 10
  ),
  CONSTRAINT marketplace_listings_game_amount_positive CHECK (
    game_currency_amount IS NULL OR game_currency_amount > 0
  ),
  CONSTRAINT marketplace_listings_status_check CHECK (
    status IN ('available', 'unavailable', 'sold')
  ),
  CONSTRAINT marketplace_listings_moderation_check CHECK (
    moderation_status IN ('pending', 'approved', 'rejected', 'removed')
  )
);

CREATE INDEX IF NOT EXISTS marketplace_listings_browse_idx
  ON public.marketplace_listings (moderation_status, status, category, created_at DESC);

CREATE INDEX IF NOT EXISTS marketplace_listings_seller_idx
  ON public.marketplace_listings (seller_id, created_at DESC);

DROP TRIGGER IF EXISTS set_marketplace_listings_updated_at ON public.marketplace_listings;
CREATE TRIGGER set_marketplace_listings_updated_at
  BEFORE UPDATE ON public.marketplace_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 2. MARKETPLACE ORDERS TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS public.marketplace_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE RESTRICT,
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  requested_game_currency_amount BIGINT,
  agreed_price_amount NUMERIC(18, 2) NOT NULL,
  agreed_price_currency TEXT NOT NULL DEFAULT 'NGN',
  recipient_lagos_life_username TEXT,
  fulfillment_mode TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'requested',
  buyer_note TEXT,
  seller_note TEXT,
  seller_marked_sent_at TIMESTAMPTZ,
  buyer_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_orders_no_self_order CHECK (buyer_id <> seller_id),
  CONSTRAINT marketplace_orders_price_positive CHECK (agreed_price_amount > 0),
  CONSTRAINT marketplace_orders_game_amount_positive CHECK (
    requested_game_currency_amount IS NULL OR requested_game_currency_amount > 0
  ),
  CONSTRAINT marketplace_orders_fulfillment_mode_check CHECK (
    fulfillment_mode IN ('manual', 'official_api')
  ),
  CONSTRAINT marketplace_orders_status_check CHECK (
    status IN (
      'requested',
      'accepted',
      'in_progress',
      'seller_marked_sent',
      'buyer_confirmed',
      'cancelled',
      'disputed',
      'rejected'
    )
  )
);

CREATE INDEX IF NOT EXISTS marketplace_orders_buyer_idx
  ON public.marketplace_orders (buyer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS marketplace_orders_seller_idx
  ON public.marketplace_orders (seller_id, created_at DESC);

CREATE INDEX IF NOT EXISTS marketplace_orders_status_idx
  ON public.marketplace_orders (status, created_at DESC);

DROP TRIGGER IF EXISTS set_marketplace_orders_updated_at ON public.marketplace_orders;
CREATE TRIGGER set_marketplace_orders_updated_at
  BEFORE UPDATE ON public.marketplace_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 3. MARKETPLACE DISPUTES TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS public.marketplace_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.marketplace_orders(id) ON DELETE RESTRICT,
  opened_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  admin_resolution_note TEXT,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  CONSTRAINT marketplace_disputes_reason_check CHECK (
    reason IN (
      'currency_not_received',
      'incorrect_amount',
      'incorrect_recipient',
      'seller_unresponsive',
      'other'
    )
  ),
  CONSTRAINT marketplace_disputes_description_length CHECK (
    char_length(trim(description)) BETWEEN 10 AND 2000
  ),
  CONSTRAINT marketplace_disputes_status_check CHECK (
    status IN ('open', 'under_review', 'resolved', 'dismissed')
  )
);

-- Prevent duplicate active disputes on the same order
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_disputes_one_active_per_order
  ON public.marketplace_disputes (order_id)
  WHERE status IN ('open', 'under_review');

CREATE INDEX IF NOT EXISTS marketplace_disputes_status_idx
  ON public.marketplace_disputes (status, created_at DESC);

-- =========================================================
-- 4. MARKETPLACE ORDER EVENTS TABLE (IMMUTABLE TIMELINE)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.marketplace_order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_order_events_type_not_empty CHECK (char_length(trim(event_type)) > 0),
  CONSTRAINT marketplace_order_events_desc_not_empty CHECK (char_length(trim(event_description)) > 0)
);

CREATE INDEX IF NOT EXISTS marketplace_order_events_order_idx
  ON public.marketplace_order_events (order_id, created_at ASC);

-- =========================================================
-- 5. ROW LEVEL SECURITY & LEAST-PRIVILEGE GRANTS
-- =========================================================
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_order_events ENABLE ROW LEVEL SECURITY;

-- Listings SELECT policy
DROP POLICY IF EXISTS "marketplace_listings_select" ON public.marketplace_listings;
CREATE POLICY "marketplace_listings_select"
  ON public.marketplace_listings
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_admin(auth.uid())
    OR auth.uid() = seller_id
    OR (
      public.is_approved_member(auth.uid())
      AND moderation_status = 'approved'
    )
  );

-- Orders SELECT policy (buyer, seller, or active admin only)
DROP POLICY IF EXISTS "marketplace_orders_select" ON public.marketplace_orders;
CREATE POLICY "marketplace_orders_select"
  ON public.marketplace_orders
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_admin(auth.uid())
    OR auth.uid() = buyer_id
    OR auth.uid() = seller_id
  );

-- Disputes SELECT policy (order participants or active admin only)
DROP POLICY IF EXISTS "marketplace_disputes_select" ON public.marketplace_disputes;
CREATE POLICY "marketplace_disputes_select"
  ON public.marketplace_disputes
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.marketplace_orders o
      WHERE o.id = marketplace_disputes.order_id
        AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

-- Order Events SELECT policy (order participants or active admin only)
DROP POLICY IF EXISTS "marketplace_order_events_select" ON public.marketplace_order_events;
CREATE POLICY "marketplace_order_events_select"
  ON public.marketplace_order_events
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.marketplace_orders o
      WHERE o.id = marketplace_order_events.order_id
        AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

-- Least-privilege table GRANTs: SELECT only for authenticated.
-- All mutations run exclusively through validated SECURITY DEFINER RPCs below.
-- Zero grants to anon or PUBLIC.
GRANT SELECT ON public.marketplace_listings TO authenticated;
GRANT SELECT ON public.marketplace_orders TO authenticated;
GRANT SELECT ON public.marketplace_disputes TO authenticated;
GRANT SELECT ON public.marketplace_order_events TO authenticated;

-- =========================================================
-- 6. HARDENED SECURITY DEFINER RPCS
-- =========================================================

-- A. Read listings with seller public VATAR username (without weakening profiles RLS)
CREATE OR REPLACE FUNCTION public.get_marketplace_listings(p_category TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  seller_id UUID,
  seller_username TEXT,
  category TEXT,
  title TEXT,
  description TEXT,
  price_amount NUMERIC,
  price_currency TEXT,
  game_currency_amount BIGINT,
  seller_contact_note TEXT,
  status TEXT,
  moderation_status TEXT,
  moderation_note TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_is_admin BOOLEAN;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  v_is_admin := public.is_active_admin(v_caller_id);

  IF NOT v_is_admin AND NOT public.is_approved_member(v_caller_id) THEN
    RAISE EXCEPTION 'Approved VATAR membership required.';
  END IF;

  RETURN QUERY
  SELECT
    l.id,
    l.seller_id,
    p.username AS seller_username,
    l.category,
    l.title,
    l.description,
    l.price_amount,
    l.price_currency,
    l.game_currency_amount,
    l.seller_contact_note,
    l.status,
    l.moderation_status,
    l.moderation_note,
    l.created_at,
    l.updated_at
  FROM public.marketplace_listings l
  JOIN public.profiles p ON p.id = l.seller_id
  WHERE (p_category IS NULL OR l.category = p_category)
    AND (
      v_is_admin
      OR l.seller_id = v_caller_id
      OR l.moderation_status = 'approved'
    )
  ORDER BY l.created_at DESC;
END;
$$;

-- B. Create listing (approved members only; always starts as pending moderation)
CREATE OR REPLACE FUNCTION public.create_marketplace_listing(
  p_category TEXT,
  p_title TEXT,
  p_description TEXT,
  p_price_amount NUMERIC,
  p_price_currency TEXT DEFAULT 'NGN',
  p_game_currency_amount BIGINT DEFAULT NULL,
  p_seller_contact_note TEXT DEFAULT NULL
)
RETURNS public.marketplace_listings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_created public.marketplace_listings;
BEGIN
  IF v_user_id IS NULL OR NOT public.is_approved_member(v_user_id) THEN
    RAISE EXCEPTION 'Only approved VATAR members may create marketplace listings.';
  END IF;

  IF p_category = 'lagos_life_funds' AND (p_game_currency_amount IS NULL OR p_game_currency_amount <= 0) THEN
    RAISE EXCEPTION 'Lagos Life game funds listings must specify a positive game currency amount.';
  END IF;

  INSERT INTO public.marketplace_listings (
    seller_id,
    category,
    title,
    description,
    price_amount,
    price_currency,
    game_currency_amount,
    seller_contact_note,
    status,
    moderation_status
  )
  VALUES (
    v_user_id,
    p_category,
    trim(p_title),
    trim(p_description),
    p_price_amount,
    upper(trim(COALESCE(p_price_currency, 'NGN'))),
    p_game_currency_amount,
    NULLIF(trim(COALESCE(p_seller_contact_note, '')), ''),
    'available',
    'pending'
  )
  RETURNING * INTO v_created;

  RETURN v_created;
END;
$$;

-- C. Seller edits own eligible listing (cannot self-approve or change moderation_status)
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
BEGIN
  IF v_user_id IS NULL OR NOT public.is_approved_member(v_user_id) THEN
    RAISE EXCEPTION 'Only approved VATAR members may update listings.';
  END IF;

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

  IF p_status NOT IN ('available', 'unavailable', 'sold') THEN
    RAISE EXCEPTION 'Invalid listing status: %', p_status;
  END IF;

  UPDATE public.marketplace_listings
  SET
    title = trim(p_title),
    description = trim(p_description),
    price_amount = p_price_amount,
    price_currency = upper(trim(COALESCE(p_price_currency, 'NGN'))),
    game_currency_amount = p_game_currency_amount,
    seller_contact_note = NULLIF(trim(COALESCE(p_seller_contact_note, '')), ''),
    status = p_status
  WHERE id = p_listing_id
  RETURNING * INTO v_updated;

  RETURN v_updated;
END;
$$;

-- D. Admin listing moderation (approve / reject / remove) with audit log
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

-- E. Buyer creates purchase request (enforces approved listing, no self-orders, manual mode)
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
  v_created public.marketplace_orders;
BEGIN
  IF v_buyer_id IS NULL OR NOT public.is_approved_member(v_buyer_id) THEN
    RAISE EXCEPTION 'Only approved VATAR members may submit purchase requests.';
  END IF;

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

  IF v_listing.category = 'lagos_life_funds' AND v_recipient IS NULL THEN
    RAISE EXCEPTION 'Recipient Lagos Life username is required for game-currency orders.';
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
    COALESCE(p_requested_game_currency_amount, v_listing.game_currency_amount),
    v_listing.price_amount,
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
    'Buyer submitted a manual fulfilment purchase request.'
  );

  RETURN v_created;
END;
$$;

-- F. State-machine order transition RPC (strict role & transition enforcement)
CREATE OR REPLACE FUNCTION public.transition_marketplace_order(
  p_order_id UUID,
  p_next_status TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS public.marketplace_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_order public.marketplace_orders;
  v_updated public.marketplace_orders;
  v_is_buyer BOOLEAN;
  v_is_seller BOOLEAN;
  v_clean_note TEXT := NULLIF(trim(COALESCE(p_note, '')), '');
  v_desc TEXT;
BEGIN
  IF v_actor_id IS NULL OR NOT public.is_approved_member(v_actor_id) THEN
    RAISE EXCEPTION 'Approved membership required.';
  END IF;

  SELECT * INTO v_order
  FROM public.marketplace_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order not found.';
  END IF;

  v_is_buyer := (v_order.buyer_id = v_actor_id);
  v_is_seller := (v_order.seller_id = v_actor_id);

  IF NOT v_is_buyer AND NOT v_is_seller THEN
    RAISE EXCEPTION 'Unauthorized: you are not a participant in this order.';
  END IF;

  IF v_order.status = 'disputed' THEN
    RAISE EXCEPTION 'This order is under dispute and cannot change status until resolved by an administrator.';
  END IF;

  IF v_order.status IN ('buyer_confirmed', 'cancelled', 'rejected') THEN
    RAISE EXCEPTION 'This order is already finalized (%).', v_order.status;
  END IF;

  -- Enforce strict role-gated state transitions
  IF p_next_status = 'cancelled' THEN
    IF NOT v_is_buyer OR v_order.status NOT IN ('requested', 'accepted') THEN
      RAISE EXCEPTION 'Only the buyer may cancel an order before fulfilment begins.';
    END IF;
    v_desc := COALESCE('Buyer cancelled the order: ' || v_clean_note, 'Buyer cancelled the order.');
  ELSIF p_next_status = 'accepted' THEN
    IF NOT v_is_seller OR v_order.status <> 'requested' THEN
      RAISE EXCEPTION 'Only the seller may accept a requested order.';
    END IF;
    v_desc := COALESCE('Seller accepted the request: ' || v_clean_note, 'Seller accepted the purchase request.');
  ELSIF p_next_status = 'rejected' THEN
    IF NOT v_is_seller OR v_order.status <> 'requested' THEN
      RAISE EXCEPTION 'Only the seller may reject a requested order.';
    END IF;
    v_desc := COALESCE('Seller rejected the request: ' || v_clean_note, 'Seller rejected the purchase request.');
  ELSIF p_next_status = 'in_progress' THEN
    IF NOT v_is_seller OR v_order.status <> 'accepted' THEN
      RAISE EXCEPTION 'Only the seller may mark an accepted order as in progress.';
    END IF;
    v_desc := COALESCE('Seller marked fulfilment in progress: ' || v_clean_note, 'Seller began manual fulfilment.');
  ELSIF p_next_status = 'seller_marked_sent' THEN
    IF NOT v_is_seller OR v_order.status NOT IN ('accepted', 'in_progress') THEN
      RAISE EXCEPTION 'Only the seller may mark an accepted or in-progress order as sent.';
    END IF;
    v_desc := COALESCE('Seller marked delivery as sent: ' || v_clean_note, 'Seller marked manual delivery as sent (awaiting buyer confirmation).');
  ELSIF p_next_status = 'buyer_confirmed' THEN
    IF NOT v_is_buyer OR v_order.status <> 'seller_marked_sent' THEN
      RAISE EXCEPTION 'Only the buyer may confirm receipt after the seller marks the order as sent.';
    END IF;
    v_desc := COALESCE('Buyer confirmed receipt: ' || v_clean_note, 'Buyer confirmed receipt of the order.');
  ELSE
    RAISE EXCEPTION 'Invalid or unsupported order transition to: %', p_next_status;
  END IF;

  UPDATE public.marketplace_orders
  SET
    status = p_next_status,
    seller_note = CASE WHEN v_is_seller AND v_clean_note IS NOT NULL THEN v_clean_note ELSE seller_note END,
    buyer_note = CASE WHEN v_is_buyer AND v_clean_note IS NOT NULL THEN v_clean_note ELSE buyer_note END,
    seller_marked_sent_at = CASE WHEN p_next_status = 'seller_marked_sent' THEN now() ELSE seller_marked_sent_at END,
    buyer_confirmed_at = CASE WHEN p_next_status = 'buyer_confirmed' THEN now() ELSE buyer_confirmed_at END
  WHERE id = p_order_id
  RETURNING * INTO v_updated;

  INSERT INTO public.marketplace_order_events (
    order_id, actor_id, event_type, event_description
  ) VALUES (
    v_updated.id,
    v_actor_id,
    'order.' || p_next_status,
    v_desc
  );

  RETURN v_updated;
END;
$$;

-- G. Open dispute on an active order (locks ordinary transitions until admin resolves)
CREATE OR REPLACE FUNCTION public.open_marketplace_dispute(
  p_order_id UUID,
  p_reason TEXT,
  p_description TEXT
)
RETURNS public.marketplace_disputes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_order public.marketplace_orders;
  v_dispute public.marketplace_disputes;
BEGIN
  IF v_actor_id IS NULL OR NOT public.is_approved_member(v_actor_id) THEN
    RAISE EXCEPTION 'Approved membership required.';
  END IF;

  IF char_length(trim(COALESCE(p_description, ''))) < 10 THEN
    RAISE EXCEPTION 'Provide a clear dispute description (at least 10 characters).';
  END IF;

  SELECT * INTO v_order
  FROM public.marketplace_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order not found.';
  END IF;

  IF v_order.buyer_id <> v_actor_id AND v_order.seller_id <> v_actor_id THEN
    RAISE EXCEPTION 'Unauthorized: only order participants may open a dispute.';
  END IF;

  IF v_order.status NOT IN ('accepted', 'in_progress', 'seller_marked_sent') THEN
    RAISE EXCEPTION 'Disputes may only be opened on accepted, in-progress, or sent orders (current status: %).', v_order.status;
  END IF;

  INSERT INTO public.marketplace_disputes (
    order_id, opened_by, reason, description, status
  ) VALUES (
    v_order.id, v_actor_id, p_reason, trim(p_description), 'open'
  )
  RETURNING * INTO v_dispute;

  UPDATE public.marketplace_orders
  SET status = 'disputed'
  WHERE id = v_order.id;

  INSERT INTO public.marketplace_order_events (
    order_id, actor_id, event_type, event_description
  ) VALUES (
    v_order.id,
    v_actor_id,
    'order.disputed',
    'Dispute opened (' || p_reason || '): ' || left(trim(p_description), 240)
  );

  INSERT INTO public.audit_logs (
    actor_id, action, entity_type, entity_id, metadata
  ) VALUES (
    v_actor_id,
    'marketplace_dispute.opened',
    'marketplace_dispute',
    v_dispute.id,
    jsonb_build_object('order_id', v_order.id, 'reason', p_reason)
  );

  RETURN v_dispute;
END;
$$;

-- H. Admin resolves or dismisses a dispute with mandatory resolution note
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
  v_updated public.marketplace_disputes;
BEGIN
  IF v_admin_id IS NULL OR NOT public.is_active_admin(v_admin_id) THEN
    RAISE EXCEPTION 'Unauthorized: active administrator role required.';
  END IF;

  IF p_dispute_status NOT IN ('resolved', 'dismissed') THEN
    RAISE EXCEPTION 'Dispute resolution status must be resolved or dismissed.';
  END IF;

  IF char_length(trim(COALESCE(p_resolution_note, ''))) < 5 THEN
    RAISE EXCEPTION 'A resolution note (at least 5 characters) is required.';
  END IF;

  IF p_target_order_status NOT IN ('buyer_confirmed', 'cancelled', 'rejected', 'in_progress') THEN
    RAISE EXCEPTION 'Invalid target order status after dispute resolution: %', p_target_order_status;
  END IF;

  SELECT * INTO v_dispute
  FROM public.marketplace_disputes
  WHERE id = p_dispute_id
  FOR UPDATE;

  IF v_dispute.id IS NULL THEN
    RAISE EXCEPTION 'Dispute not found.';
  END IF;

  UPDATE public.marketplace_disputes
  SET
    status = p_dispute_status,
    admin_resolution_note = trim(p_resolution_note),
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
  WHERE id = v_dispute.order_id;

  INSERT INTO public.marketplace_order_events (
    order_id, actor_id, event_type, event_description
  ) VALUES (
    v_dispute.order_id,
    v_admin_id,
    'dispute.' || p_dispute_status,
    'Administrator ' || p_dispute_status || ' dispute (order → ' || p_target_order_status || '): ' || trim(p_resolution_note)
  );

  INSERT INTO public.audit_logs (
    actor_id, action, entity_type, entity_id, metadata
  ) VALUES (
    v_admin_id,
    'marketplace_dispute.' || p_dispute_status,
    'marketplace_dispute',
    v_updated.id,
    jsonb_build_object(
      'order_id', v_dispute.order_id,
      'target_order_status', p_target_order_status,
      'resolution_note', trim(p_resolution_note)
    )
  );

  RETURN v_updated;
END;
$$;

-- I. Read member's own orders (purchases & sales) with listing title and counterparty public username
CREATE OR REPLACE FUNCTION public.get_my_marketplace_orders()
RETURNS TABLE (
  id UUID,
  listing_id UUID,
  listing_title TEXT,
  listing_category TEXT,
  buyer_id UUID,
  buyer_username TEXT,
  seller_id UUID,
  seller_username TEXT,
  requested_game_currency_amount BIGINT,
  agreed_price_amount NUMERIC,
  agreed_price_currency TEXT,
  recipient_lagos_life_username TEXT,
  fulfillment_mode TEXT,
  status TEXT,
  buyer_note TEXT,
  seller_note TEXT,
  seller_marked_sent_at TIMESTAMPTZ,
  buyer_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL OR NOT public.is_approved_member(v_user_id) THEN
    RAISE EXCEPTION 'Approved membership required.';
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.listing_id,
    l.title AS listing_title,
    l.category AS listing_category,
    o.buyer_id,
    bp.username AS buyer_username,
    o.seller_id,
    sp.username AS seller_username,
    o.requested_game_currency_amount,
    o.agreed_price_amount,
    o.agreed_price_currency,
    o.recipient_lagos_life_username,
    o.fulfillment_mode,
    o.status,
    o.buyer_note,
    o.seller_note,
    o.seller_marked_sent_at,
    o.buyer_confirmed_at,
    o.created_at,
    o.updated_at
  FROM public.marketplace_orders o
  JOIN public.marketplace_listings l ON l.id = o.listing_id
  JOIN public.profiles bp ON bp.id = o.buyer_id
  JOIN public.profiles sp ON sp.id = o.seller_id
  WHERE o.buyer_id = v_user_id
     OR o.seller_id = v_user_id
  ORDER BY o.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_marketplace_listings(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_marketplace_listings(TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.create_marketplace_listing(TEXT, TEXT, TEXT, NUMERIC, TEXT, BIGINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_marketplace_listing(TEXT, TEXT, TEXT, NUMERIC, TEXT, BIGINT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.update_own_marketplace_listing(UUID, TEXT, TEXT, NUMERIC, TEXT, BIGINT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_own_marketplace_listing(UUID, TEXT, TEXT, NUMERIC, TEXT, BIGINT, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_moderate_listing(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_moderate_listing(UUID, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.create_marketplace_order(UUID, BIGINT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_marketplace_order(UUID, BIGINT, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.transition_marketplace_order(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_marketplace_order(UUID, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.open_marketplace_dispute(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_marketplace_dispute(UUID, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_resolve_dispute(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_resolve_dispute(UUID, TEXT, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_marketplace_orders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_marketplace_orders() TO authenticated;
