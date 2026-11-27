-- ============================================================================
-- Migration 0012: VATAR Data Hub (MTN Daily & Weekly Plans via LagosLife Funds)
-- ============================================================================
-- Provides:
-- 1. public.data_hub_settings  (singleton receiving handle, WhatsApp & toggle)
-- 2. public.data_plans         (11 authoritative MTN Daily & Weekly plans)
-- 3. public.data_orders        (member data orders with idempotent VTU ref)
-- 4. Hardened SECURITY DEFINER RPCs + RLS + audit_logs
-- ============================================================================

-- ============================================================================
-- 1. DATA HUB SETTINGS (Singleton row id = 1)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.data_hub_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  receiving_lagos_life_handle TEXT NOT NULL DEFAULT 'softCollins',
  whatsapp_number TEXT NOT NULL DEFAULT '',
  vtu_provider TEXT NOT NULL DEFAULT 'vtpass',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.data_hub_settings (id, receiving_lagos_life_handle, vtu_provider, is_enabled)
VALUES (1, 'softCollins', 'vtpass', true)
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS set_data_hub_settings_updated_at ON public.data_hub_settings;
CREATE TRIGGER set_data_hub_settings_updated_at
  BEFORE UPDATE ON public.data_hub_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 2. AUTHORITATIVE MTN DATA PLANS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.data_plans (
  code TEXT PRIMARY KEY,
  network TEXT NOT NULL DEFAULT 'MTN',
  category TEXT NOT NULL CHECK (category IN ('daily', 'weekly')),
  data_label TEXT NOT NULL,
  validity_label TEXT NOT NULL,
  in_game_amount BIGINT NOT NULL CHECK (in_game_amount > 0),
  in_game_label TEXT NOT NULL,
  vtpass_service_id TEXT NOT NULL DEFAULT 'mtn-data',
  vtpass_variation_code TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_data_plans_updated_at ON public.data_plans;
CREATE TRIGGER set_data_plans_updated_at
  BEFORE UPDATE ON public.data_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Seed all 11 official MTN Daily & Weekly plans
INSERT INTO public.data_plans (
  code, network, category, data_label, validity_label,
  in_game_amount, in_game_label, vtpass_service_id, vtpass_variation_code, sort_order
)
VALUES
  -- MTN DAILY PLANS
  ('MTN_D_1GB',   'MTN', 'daily',  '1GB',   '1 Day',  150000000000,  '150B', 'mtn-data', 'mtn-1gb-daily',   1),
  ('MTN_D_2_5GB', 'MTN', 'daily',  '2.5GB', '1 Day',  300000000000,  '300B', 'mtn-data', 'mtn-2-5gb-daily', 2),
  ('MTN_D_5_5GB', 'MTN', 'daily',  '5.5GB', '2 Days', 500000000000,  '500B', 'mtn-data', 'mtn-5-5gb-2days', 3),
  ('MTN_D_7GB',   'MTN', 'daily',  '7GB',   '2 Days', 600000000000,  '600B', 'mtn-data', 'mtn-7gb-2days',   4),
  -- MTN WEEKLY PLANS
  ('MTN_W_1GB',   'MTN', 'weekly', '1GB',   '7 Days', 280000000000,  '280B', 'mtn-data', 'mtn-1gb-weekly',   10),
  ('MTN_W_1_5GB', 'MTN', 'weekly', '1.5GB', '7 Days', 320000000000,  '320B', 'mtn-data', 'mtn-1-5gb-weekly', 11),
  ('MTN_W_3_5GB', 'MTN', 'weekly', '3.5GB', '7 Days', 500000000000,  '500B', 'mtn-data', 'mtn-3-5gb-weekly', 12),
  ('MTN_W_6GB',   'MTN', 'weekly', '6GB',   '7 Days', 850000000000,  '850B', 'mtn-data', 'mtn-6gb-weekly',   13),
  ('MTN_W_11GB',  'MTN', 'weekly', '11GB',  '7 Days', 1200000000000, '1.2T', 'mtn-data', 'mtn-11gb-weekly',  14),
  ('MTN_W_15GB',  'MTN', 'weekly', '15GB',  '7 Days', 1500000000000, '1.5T', 'mtn-data', 'mtn-15gb-weekly',  15),
  ('MTN_W_20GB',  'MTN', 'weekly', '20GB',  '7 Days', 2000000000000, '2T',   'mtn-data', 'mtn-20gb-weekly',  16)
ON CONFLICT (code) DO UPDATE SET
  data_label = EXCLUDED.data_label,
  validity_label = EXCLUDED.validity_label,
  in_game_amount = EXCLUDED.in_game_amount,
  in_game_label = EXCLUDED.in_game_label,
  sort_order = EXCLUDED.sort_order;

-- ============================================================================
-- 3. DATA ORDERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.data_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code TEXT NOT NULL UNIQUE,
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_code TEXT NOT NULL REFERENCES public.data_plans(code),
  network TEXT NOT NULL DEFAULT 'MTN',
  plan_label TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  lagos_life_username TEXT NOT NULL,
  in_game_amount BIGINT NOT NULL CHECK (in_game_amount > 0),
  in_game_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'awaiting_transfer',
  vtu_request_id TEXT UNIQUE,
  vtu_reference TEXT,
  vtu_response_note TEXT,
  transfer_sent_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT data_orders_status_check CHECK (
    status IN (
      'awaiting_transfer',
      'transfer_sent',
      'delivering',
      'delivered',
      'failed',
      'rejected',
      'cancelled'
    )
  ),
  CONSTRAINT data_orders_phone_check CHECK (
    phone_number ~ '^[0-9]{11}$'
  ),
  CONSTRAINT data_orders_username_length CHECK (
    char_length(trim(lagos_life_username)) BETWEEN 2 AND 64
  )
);

CREATE INDEX IF NOT EXISTS data_orders_buyer_idx
  ON public.data_orders (buyer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS data_orders_status_idx
  ON public.data_orders (status, created_at DESC);

DROP TRIGGER IF EXISTS set_data_orders_updated_at ON public.data_orders;
CREATE TRIGGER set_data_orders_updated_at
  BEFORE UPDATE ON public.data_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 4. RLS & LEAST-PRIVILEGE GRANTS
-- ============================================================================
ALTER TABLE public.data_hub_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_orders ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.data_hub_settings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.data_plans FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.data_orders FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.data_hub_settings TO authenticated;
GRANT SELECT ON TABLE public.data_plans TO authenticated;
GRANT SELECT ON TABLE public.data_orders TO authenticated;

DROP POLICY IF EXISTS "data_hub_settings_select_approved" ON public.data_hub_settings;
CREATE POLICY "data_hub_settings_select_approved"
  ON public.data_hub_settings
  FOR SELECT
  TO authenticated
  USING (
    public.is_approved_member(auth.uid())
    OR public.is_active_admin(auth.uid())
  );

DROP POLICY IF EXISTS "data_plans_select_approved" ON public.data_plans;
CREATE POLICY "data_plans_select_approved"
  ON public.data_plans
  FOR SELECT
  TO authenticated
  USING (
    public.is_approved_member(auth.uid())
    OR public.is_active_admin(auth.uid())
  );

DROP POLICY IF EXISTS "data_orders_select_own_or_admin" ON public.data_orders;
CREATE POLICY "data_orders_select_own_or_admin"
  ON public.data_orders
  FOR SELECT
  TO authenticated
  USING (
    (buyer_id = auth.uid() AND public.is_approved_member(auth.uid()))
    OR public.is_active_admin(auth.uid())
  );

-- ============================================================================
-- 5. RPC: CREATE DATA ORDER (Server-Validated Plan & Nigerian Phone Number)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_data_order(
  p_plan_code TEXT,
  p_phone_number TEXT,
  p_lagos_life_username TEXT DEFAULT NULL
)
RETURNS public.data_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_phone TEXT := regexp_replace(trim(COALESCE(p_phone_number, '')), '[^0-9]', '', 'g');
  v_username TEXT := trim(COALESCE(p_lagos_life_username, ''));
  v_enabled BOOLEAN;
  v_plan public.data_plans;
  v_order_code TEXT;
  v_order public.data_orders;
BEGIN
  IF v_uid IS NULL OR NOT public.is_approved_member(v_uid) THEN
    RAISE EXCEPTION 'Unauthorized: approved membership required to order data.';
  END IF;

  SELECT is_enabled INTO v_enabled
  FROM public.data_hub_settings
  WHERE id = 1;

  IF COALESCE(v_enabled, false) = false THEN
    RAISE EXCEPTION 'VATAR Data Hub is temporarily paused.';
  END IF;

  -- Normalize +23480... to 080...
  IF char_length(v_phone) = 13 AND left(v_phone, 3) = '234' THEN
    v_phone := '0' || substr(v_phone, 4);
  END IF;

  IF v_phone !~ '^0[789][01][0-9]{8}$' THEN
    RAISE EXCEPTION 'Enter a valid 11-digit Nigerian phone number (e.g. 08031234567).';
  END IF;

  IF v_username = '' THEN
    SELECT lagos_life_username INTO v_username
    FROM public.profiles
    WHERE id = v_uid;
  END IF;

  IF char_length(trim(COALESCE(v_username, ''))) < 2 THEN
    RAISE EXCEPTION 'Please enter your LagosLife username.';
  END IF;

  SELECT * INTO v_plan
  FROM public.data_plans
  WHERE code = trim(COALESCE(p_plan_code, ''))
    AND is_active = true;

  IF v_plan.code IS NULL THEN
    RAISE EXCEPTION 'Selected data plan is unavailable.';
  END IF;

  v_order_code := 'DATA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  INSERT INTO public.data_orders (
    order_code,
    buyer_id,
    plan_code,
    network,
    plan_label,
    phone_number,
    lagos_life_username,
    in_game_amount,
    in_game_label,
    status
  )
  VALUES (
    v_order_code,
    v_uid,
    v_plan.code,
    v_plan.network,
    v_plan.network || ' ' || v_plan.data_label || ' (' || v_plan.validity_label || ')',
    v_phone,
    v_username,
    v_plan.in_game_amount,
    v_plan.in_game_label,
    'awaiting_transfer'
  )
  RETURNING * INTO v_order;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, target_user_id, metadata)
  VALUES (
    v_uid,
    'data_order_created',
    'data_order',
    v_order.id,
    v_uid,
    jsonb_build_object(
      'order_code', v_order.order_code,
      'plan_label', v_order.plan_label,
      'in_game_label', v_order.in_game_label,
      'phone_number', v_order.phone_number
    )
  );

  RETURN v_order;
END;
$$;

-- ============================================================================
-- 6. RPC: BUYER MARKS IN-GAME TRANSFER SENT
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mark_data_transfer_sent(
  p_order_id UUID
)
RETURNS public.data_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_order public.data_orders;
BEGIN
  IF v_uid IS NULL OR NOT public.is_approved_member(v_uid) THEN
    RAISE EXCEPTION 'Unauthorized: approved membership required.';
  END IF;

  UPDATE public.data_orders
  SET
    status = 'transfer_sent',
    transfer_sent_at = COALESCE(transfer_sent_at, now())
  WHERE id = p_order_id
    AND buyer_id = v_uid
    AND status IN ('awaiting_transfer', 'transfer_sent')
  RETURNING * INTO v_order;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Data order not found or cannot be updated.';
  END IF;

  RETURN v_order;
END;
$$;

-- ============================================================================
-- 7. RPC: BUYER CANCELS UNFULFILLED DATA ORDER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cancel_data_order(
  p_order_id UUID
)
RETURNS public.data_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_order public.data_orders;
BEGIN
  IF v_uid IS NULL OR NOT public.is_approved_member(v_uid) THEN
    RAISE EXCEPTION 'Unauthorized: approved membership required.';
  END IF;

  UPDATE public.data_orders
  SET status = 'cancelled'
  WHERE id = p_order_id
    AND buyer_id = v_uid
    AND status IN ('awaiting_transfer', 'transfer_sent')
  RETURNING * INTO v_order;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Data order cannot be cancelled in its current state.';
  END IF;

  RETURN v_order;
END;
$$;

-- ============================================================================
-- 8. RPC: ADMIN UPDATE DATA ORDER (Delivered / Failed / Rejected)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_update_data_order(
  p_order_id UUID,
  p_new_status TEXT,
  p_vtu_reference TEXT DEFAULT NULL,
  p_vtu_response_note TEXT DEFAULT NULL
)
RETURNS public.data_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_order public.data_orders;
BEGIN
  IF v_uid IS NULL OR NOT public.is_active_admin(v_uid) THEN
    RAISE EXCEPTION 'Unauthorized: active administrator role required.';
  END IF;

  IF p_new_status NOT IN ('delivering', 'delivered', 'failed', 'rejected') THEN
    RAISE EXCEPTION 'Invalid admin data order status: %', p_new_status;
  END IF;

  UPDATE public.data_orders
  SET
    status = p_new_status,
    vtu_reference = COALESCE(NULLIF(trim(COALESCE(p_vtu_reference, '')), ''), vtu_reference),
    vtu_response_note = COALESCE(NULLIF(trim(COALESCE(p_vtu_response_note, '')), ''), vtu_response_note),
    approved_by = COALESCE(approved_by, v_uid),
    approved_at = COALESCE(approved_at, now()),
    delivered_at = CASE WHEN p_new_status = 'delivered' THEN now() ELSE delivered_at END
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Data order not found.';
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, target_user_id, metadata)
  VALUES (
    v_uid,
    'data_order_' || p_new_status,
    'data_order',
    v_order.id,
    v_order.buyer_id,
    jsonb_build_object(
      'order_code', v_order.order_code,
      'plan_label', v_order.plan_label,
      'phone_number', v_order.phone_number,
      'vtu_reference', v_order.vtu_reference,
      'status', p_new_status
    )
  );

  RETURN v_order;
END;
$$;

-- ============================================================================
-- 9. RPC: ADMIN UPDATE DATA HUB SETTINGS & VARIATION CODES
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_update_data_hub_settings(
  p_receiving_handle TEXT,
  p_whatsapp_number TEXT,
  p_is_enabled BOOLEAN DEFAULT true
)
RETURNS public.data_hub_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_settings public.data_hub_settings;
BEGIN
  IF v_uid IS NULL OR NOT public.is_active_admin(v_uid) THEN
    RAISE EXCEPTION 'Unauthorized: active administrator role required.';
  END IF;

  UPDATE public.data_hub_settings
  SET
    receiving_lagos_life_handle = regexp_replace(trim(COALESCE(p_receiving_handle, 'softCollins')), '^@', ''),
    whatsapp_number = regexp_replace(trim(COALESCE(p_whatsapp_number, '')), '[^0-9]', '', 'g'),
    is_enabled = COALESCE(p_is_enabled, true),
    updated_by = v_uid
  WHERE id = 1
  RETURNING * INTO v_settings;

  RETURN v_settings;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_data_plan_variation(
  p_plan_code TEXT,
  p_vtpass_variation_code TEXT
)
RETURNS public.data_plans
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_plan public.data_plans;
BEGIN
  IF v_uid IS NULL OR NOT public.is_active_admin(v_uid) THEN
    RAISE EXCEPTION 'Unauthorized: active administrator role required.';
  END IF;

  UPDATE public.data_plans
  SET vtpass_variation_code = trim(COALESCE(p_vtpass_variation_code, ''))
  WHERE code = trim(COALESCE(p_plan_code, ''))
  RETURNING * INTO v_plan;

  IF v_plan.code IS NULL THEN
    RAISE EXCEPTION 'Data plan not found.';
  END IF;

  RETURN v_plan;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_pending_data_orders_count()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_count INTEGER := 0;
BEGIN
  IF v_uid IS NULL OR NOT public.is_active_admin(v_uid) THEN
    RETURN 0;
  END IF;

  SELECT count(*)::INTEGER INTO v_count
  FROM public.data_orders
  WHERE status IN ('awaiting_transfer', 'transfer_sent', 'delivering');

  RETURN v_count;
END;
$$;

-- ============================================================================
-- 10. FUNCTION EXECUTE PERMISSIONS
-- ============================================================================
REVOKE ALL ON FUNCTION public.create_data_order(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_data_order(TEXT, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.mark_data_transfer_sent(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_data_transfer_sent(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_data_order(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_data_order(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_update_data_order(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_data_order(UUID, TEXT, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_update_data_hub_settings(TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_data_hub_settings(TEXT, TEXT, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_update_data_plan_variation(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_data_plan_variation(TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.get_pending_data_orders_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pending_data_orders_count() TO authenticated;
