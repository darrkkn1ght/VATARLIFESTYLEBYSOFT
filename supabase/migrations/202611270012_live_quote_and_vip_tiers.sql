-- ============================================================================
-- Migration 0012: Live Quote Marketplace (₦1,500 / 1T, Min 1T - Max 1000T)
--                 + Paid VIP Membership Discount Tiers (Gold/Platinum/Diamond/Elite)
-- ============================================================================

-- ============================================================================
-- 1. EXPAND MONEY PACK ORDERS FOR 1T-1000T + VIP DISCOUNTS
-- ============================================================================
ALTER TABLE public.money_pack_orders
  DROP CONSTRAINT IF EXISTS money_pack_orders_quantity_check;

ALTER TABLE public.money_pack_orders
  ADD CONSTRAINT money_pack_orders_quantity_check CHECK (quantity BETWEEN 1 AND 1000);

ALTER TABLE public.money_pack_orders
  ADD COLUMN IF NOT EXISTS discount_percent INTEGER NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 50),
  ADD COLUMN IF NOT EXISTS vip_tier TEXT;

-- ============================================================================
-- 2. VIP MEMBERSHIPS (Active Discount Entitlements)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.vip_memberships (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('gold', 'platinum', 'diamond', 'elite')),
  discount_percent INTEGER NOT NULL CHECK (discount_percent IN (5, 8, 12, 20)),
  monthly_price_ngn INTEGER NOT NULL CHECK (monthly_price_ngn > 0),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_vip_memberships_updated_at ON public.vip_memberships;
CREATE TRIGGER set_vip_memberships_updated_at
  BEFORE UPDATE ON public.vip_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 3. VIP UPGRADE REQUESTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.vip_upgrade_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_code TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('gold', 'platinum', 'diamond', 'elite')),
  discount_percent INTEGER NOT NULL CHECK (discount_percent IN (5, 8, 12, 20)),
  price_ngn INTEGER NOT NULL CHECK (price_ngn > 0),
  status TEXT NOT NULL DEFAULT 'awaiting_payment' CHECK (
    status IN ('awaiting_payment', 'payment_submitted', 'approved', 'rejected', 'cancelled')
  ),
  payment_submitted_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vip_upgrade_requests_user_idx
  ON public.vip_upgrade_requests (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS vip_upgrade_requests_status_idx
  ON public.vip_upgrade_requests (status, created_at DESC);

DROP TRIGGER IF EXISTS set_vip_upgrade_requests_updated_at ON public.vip_upgrade_requests;
CREATE TRIGGER set_vip_upgrade_requests_updated_at
  BEFORE UPDATE ON public.vip_upgrade_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 4. RLS & LEAST-PRIVILEGE GRANTS
-- ============================================================================
ALTER TABLE public.vip_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vip_upgrade_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.vip_memberships FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.vip_upgrade_requests FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.vip_memberships TO authenticated;
GRANT SELECT ON TABLE public.vip_upgrade_requests TO authenticated;

DROP POLICY IF EXISTS "vip_memberships_select_own_or_admin" ON public.vip_memberships;
CREATE POLICY "vip_memberships_select_own_or_admin"
  ON public.vip_memberships
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_active_admin(auth.uid())
  );

DROP POLICY IF EXISTS "vip_upgrade_requests_select_own_or_admin" ON public.vip_upgrade_requests;
CREATE POLICY "vip_upgrade_requests_select_own_or_admin"
  ON public.vip_upgrade_requests
  FOR SELECT
  TO authenticated
  USING (
    (user_id = auth.uid() AND public.is_approved_member(auth.uid()))
    OR public.is_active_admin(auth.uid())
  );

-- ============================================================================
-- 5. RPC: CREATE LIVE QUOTE ORDER (Min 500B = ₦800 | ₦1,500 / 1T | Max 1000T + VIP Discount)
-- ============================================================================
DROP FUNCTION IF EXISTS public.create_trillion_quote_order(INTEGER, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_trillion_quote_order(
  p_trillions NUMERIC,
  p_lagos_life_username TEXT,
  p_buyer_note TEXT DEFAULT NULL
)
RETURNS public.money_pack_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_trillions NUMERIC := ROUND(COALESCE(p_trillions, 0) * 2) / 2.0;
  v_whole_t INTEGER;
  v_has_half BOOLEAN;
  v_username TEXT := regexp_replace(trim(COALESCE(p_lagos_life_username, '')), '^@', '');
  v_enabled BOOLEAN;
  v_base_rate INTEGER := 1500; -- ₦1,500 per 1T
  v_half_rate INTEGER := 800;  -- ₦800 per 500B (0.5T)
  v_base_total INTEGER;
  v_discount INTEGER := 0;
  v_vip_tier TEXT := NULL;
  v_total_price INTEGER;
  v_pack_code TEXT;
  v_pack_label TEXT;
  v_order_code TEXT;
  v_order public.money_pack_orders;
BEGIN
  IF v_uid IS NULL OR NOT public.is_approved_member(v_uid) THEN
    RAISE EXCEPTION 'Unauthorized: approved membership required to place an order.';
  END IF;

  SELECT is_enabled INTO v_enabled
  FROM public.money_pack_settings
  WHERE id = 1;

  IF COALESCE(v_enabled, false) = false THEN
    RAISE EXCEPTION 'Marketplace currency orders are temporarily paused.';
  END IF;

  IF v_trillions < 0.5 OR v_trillions > 1000 THEN
    RAISE EXCEPTION 'Order amount must be between 0.5T (500B minimum) and 1000T (maximum).';
  END IF;

  IF char_length(v_username) < 2 OR char_length(v_username) > 64 THEN
    RAISE EXCEPTION 'Please enter a valid LagosLife username.';
  END IF;

  v_whole_t := floor(v_trillions)::INTEGER;
  v_has_half := (v_trillions - v_whole_t) >= 0.5;
  v_base_total := (v_whole_t * v_base_rate) + CASE WHEN v_has_half THEN v_half_rate ELSE 0 END;

  -- Check active VIP membership discount
  SELECT tier, discount_percent INTO v_vip_tier, v_discount
  FROM public.vip_memberships
  WHERE user_id = v_uid
    AND expires_at > now();

  v_discount := COALESCE(v_discount, 0);
  v_total_price := ROUND(v_base_total * (100 - v_discount) / 100.0)::INTEGER;
  v_pack_code := CASE WHEN v_trillions = 0.5 THEN '500B' ELSE '1T' END;
  v_pack_label := CASE
    WHEN v_trillions = 0.5 THEN '500B'
    WHEN v_has_half THEN v_whole_t || '.5T'
    ELSE v_whole_t || 'T'
  END;
  v_order_code := 'VTR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  INSERT INTO public.money_pack_orders (
    order_code,
    buyer_id,
    lagos_life_username,
    pack_code,
    pack_label,
    quantity,
    in_game_amount,
    unit_price_ngn,
    total_price_ngn,
    discount_percent,
    vip_tier,
    status,
    buyer_note
  )
  VALUES (
    v_order_code,
    v_uid,
    v_username,
    v_pack_code,
    v_pack_label,
    GREATEST(1, ROUND(v_trillions)::INTEGER),
    ROUND(v_trillions * 1000000000000)::BIGINT,
    CASE WHEN v_trillions = 0.5 THEN v_half_rate ELSE v_base_rate END,
    v_total_price,
    v_discount,
    v_vip_tier,
    'awaiting_payment',
    NULLIF(trim(COALESCE(p_buyer_note, '')), '')
  )
  RETURNING * INTO v_order;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, target_user_id, metadata)
  VALUES (
    v_uid,
    'money_pack_order_created',
    'money_pack_order',
    v_order.id,
    v_uid,
    jsonb_build_object(
      'order_code', v_order.order_code,
      'pack_label', v_order.pack_label,
      'trillions', v_trillions,
      'discount_percent', v_discount,
      'vip_tier', v_vip_tier,
      'total_price_ngn', v_order.total_price_ngn,
      'lagos_life_username', v_order.lagos_life_username
    )
  );

  RETURN v_order;
END;
$$;

-- ============================================================================
-- 6. RPC: REQUEST VIP MEMBERSHIP UPGRADE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.request_vip_upgrade(
  p_tier TEXT
)
RETURNS public.vip_upgrade_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_tier TEXT := lower(trim(COALESCE(p_tier, '')));
  v_discount INTEGER;
  v_price INTEGER;
  v_code TEXT;
  v_req public.vip_upgrade_requests;
BEGIN
  IF v_uid IS NULL OR NOT public.is_approved_member(v_uid) THEN
    RAISE EXCEPTION 'Unauthorized: approved membership required.';
  END IF;

  CASE v_tier
    WHEN 'gold'     THEN v_discount := 5;  v_price := 30000;
    WHEN 'platinum' THEN v_discount := 8;  v_price := 50000;
    WHEN 'diamond'  THEN v_discount := 12; v_price := 100000;
    WHEN 'elite'    THEN v_discount := 20; v_price := 200000;
    ELSE
      RAISE EXCEPTION 'Invalid VIP tier: %', p_tier;
  END CASE;

  v_code := 'VIP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  INSERT INTO public.vip_upgrade_requests (
    request_code,
    user_id,
    tier,
    discount_percent,
    price_ngn,
    status
  )
  VALUES (
    v_code,
    v_uid,
    v_tier,
    v_discount,
    v_price,
    'awaiting_payment'
  )
  RETURNING * INTO v_req;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, target_user_id, metadata)
  VALUES (
    v_uid,
    'vip_upgrade_requested',
    'vip_upgrade_request',
    v_req.id,
    v_uid,
    jsonb_build_object('request_code', v_code, 'tier', v_tier, 'price_ngn', v_price)
  );

  RETURN v_req;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_vip_payment_submitted(
  p_request_id UUID
)
RETURNS public.vip_upgrade_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_req public.vip_upgrade_requests;
BEGIN
  IF v_uid IS NULL OR NOT public.is_approved_member(v_uid) THEN
    RAISE EXCEPTION 'Unauthorized.';
  END IF;

  UPDATE public.vip_upgrade_requests
  SET
    status = 'payment_submitted',
    payment_submitted_at = COALESCE(payment_submitted_at, now())
  WHERE id = p_request_id
    AND user_id = v_uid
    AND status IN ('awaiting_payment', 'payment_submitted')
  RETURNING * INTO v_req;

  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'VIP upgrade request not found.';
  END IF;

  RETURN v_req;
END;
$$;

-- ============================================================================
-- 7. RPC: ADMIN APPROVE / REJECT VIP MEMBERSHIP UPGRADE (Activates 30-Day Tier)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_review_vip_upgrade(
  p_request_id UUID,
  p_decision TEXT,
  p_admin_note TEXT DEFAULT NULL
)
RETURNS public.vip_upgrade_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_decision TEXT := lower(trim(COALESCE(p_decision, '')));
  v_req public.vip_upgrade_requests;
BEGIN
  IF v_uid IS NULL OR NOT public.is_active_admin(v_uid) THEN
    RAISE EXCEPTION 'Unauthorized: active administrator role required.';
  END IF;

  IF v_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Decision must be approved or rejected.';
  END IF;

  UPDATE public.vip_upgrade_requests
  SET
    status = v_decision,
    approved_by = v_uid,
    approved_at = now(),
    admin_note = COALESCE(NULLIF(trim(COALESCE(p_admin_note, '')), ''), admin_note)
  WHERE id = p_request_id
  RETURNING * INTO v_req;

  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'VIP upgrade request not found.';
  END IF;

  IF v_decision = 'approved' THEN
    INSERT INTO public.vip_memberships (
      user_id,
      tier,
      discount_percent,
      monthly_price_ngn,
      started_at,
      expires_at,
      approved_by
    )
    VALUES (
      v_req.user_id,
      v_req.tier,
      v_req.discount_percent,
      v_req.price_ngn,
      now(),
      now() + INTERVAL '30 days',
      v_uid
    )
    ON CONFLICT (user_id) DO UPDATE SET
      tier = EXCLUDED.tier,
      discount_percent = EXCLUDED.discount_percent,
      monthly_price_ngn = EXCLUDED.monthly_price_ngn,
      started_at = now(),
      expires_at = GREATEST(public.vip_memberships.expires_at, now()) + INTERVAL '30 days',
      approved_by = v_uid;
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, target_user_id, metadata)
  VALUES (
    v_uid,
    'vip_upgrade_' || v_decision,
    'vip_upgrade_request',
    v_req.id,
    v_req.user_id,
    jsonb_build_object(
      'request_code', v_req.request_code,
      'tier', v_req.tier,
      'discount_percent', v_req.discount_percent,
      'price_ngn', v_req.price_ngn
    )
  );

  RETURN v_req;
END;
$$;

-- ============================================================================
-- 8. FUNCTION EXECUTE PERMISSIONS
-- ============================================================================
REVOKE ALL ON FUNCTION public.create_trillion_quote_order(NUMERIC, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_trillion_quote_order(NUMERIC, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.request_vip_upgrade(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_vip_upgrade(TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.mark_vip_payment_submitted(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_vip_payment_submitted(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_review_vip_upgrade(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_review_vip_upgrade(UUID, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- 9. REAL MEMBER REVIEWS & 5-STAR RATINGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.site_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL CHECK (char_length(trim(comment)) BETWEEN 5 AND 400),
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS site_reviews_visible_idx
  ON public.site_reviews (is_visible, updated_at DESC);

DROP TRIGGER IF EXISTS set_site_reviews_updated_at ON public.site_reviews;
CREATE TRIGGER set_site_reviews_updated_at
  BEFORE UPDATE ON public.site_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.site_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.site_reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.site_reviews TO authenticated;

DROP POLICY IF EXISTS "site_reviews_select_own_or_admin" ON public.site_reviews;
CREATE POLICY "site_reviews_select_own_or_admin"
  ON public.site_reviews
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_active_admin(auth.uid()));

-- Publicly readable safe reviews feed (works on HomePage for guests + members)
CREATE OR REPLACE FUNCTION public.get_public_reviews(p_limit INTEGER DEFAULT 24)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  username TEXT,
  full_name TEXT,
  vip_tier TEXT,
  rating INTEGER,
  comment TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.user_id,
    COALESCE(p.username, 'member')::TEXT AS username,
    COALESCE(p.full_name, 'VATAR Member')::TEXT AS full_name,
    CASE WHEN v.expires_at > now() THEN v.tier ELSE NULL END AS vip_tier,
    r.rating,
    r.comment,
    r.created_at,
    r.updated_at
  FROM public.site_reviews r
  LEFT JOIN public.profiles p ON p.id = r.user_id
  LEFT JOIN public.vip_memberships v ON v.user_id = r.user_id
  WHERE r.is_visible = true
  ORDER BY r.updated_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 24), 50));
END;
$$;

-- Approved members can post or update their own 1-5 star review
CREATE OR REPLACE FUNCTION public.submit_site_review(
  p_rating INTEGER,
  p_comment TEXT
)
RETURNS public.site_reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_clean TEXT := trim(COALESCE(p_comment, ''));
  v_review public.site_reviews;
BEGIN
  IF v_uid IS NULL OR NOT public.is_approved_member(v_uid) THEN
    RAISE EXCEPTION 'Sign in as an approved member to leave a verified review.';
  END IF;

  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5 stars.';
  END IF;

  IF char_length(v_clean) < 5 OR char_length(v_clean) > 400 THEN
    RAISE EXCEPTION 'Review must be between 5 and 400 characters.';
  END IF;

  INSERT INTO public.site_reviews (user_id, rating, comment, is_visible)
  VALUES (v_uid, p_rating, v_clean, true)
  ON CONFLICT (user_id) DO UPDATE SET
    rating = EXCLUDED.rating,
    comment = EXCLUDED.comment,
    is_visible = true
  RETURNING * INTO v_review;

  RETURN v_review;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_reviews(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_reviews(INTEGER) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.submit_site_review(INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_site_review(INTEGER, TEXT) TO authenticated;
