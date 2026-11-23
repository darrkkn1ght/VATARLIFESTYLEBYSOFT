-- ============================================================================
-- Migration 0010: Official VATAR Money Packs (Owner In-Game Currency Store)
-- ============================================================================
-- Provides:
-- 1. public.money_pack_settings (singleton bank & WhatsApp payout settings)
-- 2. public.money_pack_orders   (member money pack orders & fulfilment tracking)
-- 3. Hardened SECURITY DEFINER RPCs with server-side price validation & audit logs
-- 4. RLS policies enforcing approved-member & active-admin authorization
-- ============================================================================

-- ============================================================================
-- 1. MONEY PACK SETTINGS (Singleton row id = 1)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.money_pack_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  bank_name TEXT NOT NULL DEFAULT '',
  account_number TEXT NOT NULL DEFAULT '',
  account_name TEXT NOT NULL DEFAULT '',
  whatsapp_number TEXT NOT NULL DEFAULT '',
  telegram_url TEXT NOT NULL DEFAULT 'https://t.me/VatarLifeStyleBySoft',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.money_pack_settings (id, telegram_url)
VALUES (1, 'https://t.me/VatarLifeStyleBySoft')
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS set_money_pack_settings_updated_at ON public.money_pack_settings;
CREATE TRIGGER set_money_pack_settings_updated_at
  BEFORE UPDATE ON public.money_pack_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 2. MONEY PACK ORDERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.money_pack_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code TEXT NOT NULL UNIQUE,
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lagos_life_username TEXT NOT NULL,
  pack_code TEXT NOT NULL,
  pack_label TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 20),
  in_game_amount BIGINT NOT NULL CHECK (in_game_amount > 0),
  unit_price_ngn INTEGER NOT NULL CHECK (unit_price_ngn > 0),
  total_price_ngn INTEGER NOT NULL CHECK (total_price_ngn > 0),
  status TEXT NOT NULL DEFAULT 'awaiting_payment',
  buyer_note TEXT,
  admin_note TEXT,
  payment_submitted_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT money_pack_orders_status_check CHECK (
    status IN (
      'awaiting_payment',
      'payment_submitted',
      'sending',
      'completed',
      'rejected',
      'cancelled'
    )
  ),
  CONSTRAINT money_pack_orders_pack_code_check CHECK (
    pack_code IN (
      '100B', '200B', '300B', '400B', '500B',
      '600B', '700B', '800B', '900B', '1T'
    )
  ),
  CONSTRAINT money_pack_orders_username_length CHECK (
    char_length(trim(lagos_life_username)) BETWEEN 2 AND 64
  )
);

CREATE INDEX IF NOT EXISTS money_pack_orders_buyer_idx
  ON public.money_pack_orders (buyer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS money_pack_orders_status_idx
  ON public.money_pack_orders (status, created_at DESC);

DROP TRIGGER IF EXISTS set_money_pack_orders_updated_at ON public.money_pack_orders;
CREATE TRIGGER set_money_pack_orders_updated_at
  BEFORE UPDATE ON public.money_pack_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 3. RLS & LEAST-PRIVILEGE GRANTS
-- ============================================================================
ALTER TABLE public.money_pack_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.money_pack_orders ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.money_pack_settings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.money_pack_orders FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.money_pack_settings TO authenticated;
GRANT SELECT ON TABLE public.money_pack_orders TO authenticated;

DROP POLICY IF EXISTS "money_pack_settings_select_approved" ON public.money_pack_settings;
CREATE POLICY "money_pack_settings_select_approved"
  ON public.money_pack_settings
  FOR SELECT
  TO authenticated
  USING (
    public.is_approved_member(auth.uid())
    OR public.is_active_admin(auth.uid())
  );

DROP POLICY IF EXISTS "money_pack_orders_select_own_or_admin" ON public.money_pack_orders;
CREATE POLICY "money_pack_orders_select_own_or_admin"
  ON public.money_pack_orders
  FOR SELECT
  TO authenticated
  USING (
    (buyer_id = auth.uid() AND public.is_approved_member(auth.uid()))
    OR public.is_active_admin(auth.uid())
  );

-- ============================================================================
-- 4. RPC: CREATE MONEY PACK ORDER (Server-Validated Pricing)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_money_pack_order(
  p_pack_code TEXT,
  p_quantity INTEGER DEFAULT 1,
  p_lagos_life_username TEXT DEFAULT NULL,
  p_buyer_note TEXT DEFAULT NULL
)
RETURNS public.money_pack_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_code TEXT := upper(trim(COALESCE(p_pack_code, '')));
  v_qty INTEGER := COALESCE(p_quantity, 1);
  v_username TEXT := trim(COALESCE(p_lagos_life_username, ''));
  v_unit_amount BIGINT;
  v_unit_price INTEGER;
  v_pack_label TEXT;
  v_order_code TEXT;
  v_enabled BOOLEAN;
  v_order public.money_pack_orders;
BEGIN
  IF v_uid IS NULL OR NOT public.is_approved_member(v_uid) THEN
    RAISE EXCEPTION 'Unauthorized: approved membership required to order money packs.';
  END IF;

  SELECT is_enabled INTO v_enabled
  FROM public.money_pack_settings
  WHERE id = 1;

  IF COALESCE(v_enabled, false) = false THEN
    RAISE EXCEPTION 'Money pack orders are temporarily paused.';
  END IF;

  IF v_qty < 1 OR v_qty > 20 THEN
    RAISE EXCEPTION 'Quantity must be between 1 and 20.';
  END IF;

  IF v_username = '' THEN
    SELECT lagos_life_username INTO v_username
    FROM public.profiles
    WHERE id = v_uid;
  END IF;

  IF char_length(trim(COALESCE(v_username, ''))) < 2 THEN
    RAISE EXCEPTION 'Please enter a valid LagosLife username.';
  END IF;

  -- Authoritative server-side tier pricing
  CASE v_code
    WHEN '100B' THEN v_unit_amount := 100000000000;  v_unit_price := 400;
    WHEN '200B' THEN v_unit_amount := 200000000000;  v_unit_price := 700;
    WHEN '300B' THEN v_unit_amount := 300000000000;  v_unit_price := 1000;
    WHEN '400B' THEN v_unit_amount := 400000000000;  v_unit_price := 1300;
    WHEN '500B' THEN v_unit_amount := 500000000000;  v_unit_price := 1500;
    WHEN '600B' THEN v_unit_amount := 600000000000;  v_unit_price := 1800;
    WHEN '700B' THEN v_unit_amount := 700000000000;  v_unit_price := 2000;
    WHEN '800B' THEN v_unit_amount := 800000000000;  v_unit_price := 2400;
    WHEN '900B' THEN v_unit_amount := 900000000000;  v_unit_price := 2600;
    WHEN '1T'   THEN v_unit_amount := 1000000000000; v_unit_price := 2900;
    ELSE
      RAISE EXCEPTION 'Invalid money pack tier: %', v_code;
  END CASE;

  v_pack_label := CASE WHEN v_qty > 1 THEN v_qty || 'x ' || v_code ELSE v_code END;
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
    status,
    buyer_note
  )
  VALUES (
    v_order_code,
    v_uid,
    v_username,
    v_code,
    v_pack_label,
    v_qty,
    v_unit_amount * v_qty,
    v_unit_price,
    v_unit_price * v_qty,
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
      'total_price_ngn', v_order.total_price_ngn,
      'lagos_life_username', v_order.lagos_life_username
    )
  );

  RETURN v_order;
END;
$$;

-- ============================================================================
-- 5. RPC: BUYER MARKS PAYMENT SUBMITTED ("I've Paid")
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mark_money_pack_payment_submitted(
  p_order_id UUID
)
RETURNS public.money_pack_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_order public.money_pack_orders;
BEGIN
  IF v_uid IS NULL OR NOT public.is_approved_member(v_uid) THEN
    RAISE EXCEPTION 'Unauthorized: approved membership required.';
  END IF;

  UPDATE public.money_pack_orders
  SET
    status = 'payment_submitted',
    payment_submitted_at = COALESCE(payment_submitted_at, now())
  WHERE id = p_order_id
    AND buyer_id = v_uid
    AND status IN ('awaiting_payment', 'payment_submitted')
  RETURNING * INTO v_order;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order not found or cannot be marked as paid.';
  END IF;

  RETURN v_order;
END;
$$;

-- ============================================================================
-- 6. RPC: BUYER CANCELS OWN UNFULFILLED ORDER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cancel_money_pack_order(
  p_order_id UUID
)
RETURNS public.money_pack_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_order public.money_pack_orders;
BEGIN
  IF v_uid IS NULL OR NOT public.is_approved_member(v_uid) THEN
    RAISE EXCEPTION 'Unauthorized: approved membership required.';
  END IF;

  UPDATE public.money_pack_orders
  SET status = 'cancelled'
  WHERE id = p_order_id
    AND buyer_id = v_uid
    AND status IN ('awaiting_payment', 'payment_submitted')
  RETURNING * INTO v_order;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order cannot be cancelled in its current state.';
  END IF;

  RETURN v_order;
END;
$$;

-- ============================================================================
-- 7. RPC: ADMIN UPDATE ORDER STATUS (Sending / Completed / Rejected)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_update_money_pack_order(
  p_order_id UUID,
  p_new_status TEXT,
  p_admin_note TEXT DEFAULT NULL
)
RETURNS public.money_pack_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_order public.money_pack_orders;
BEGIN
  IF v_uid IS NULL OR NOT public.is_active_admin(v_uid) THEN
    RAISE EXCEPTION 'Unauthorized: active administrator role required.';
  END IF;

  IF p_new_status NOT IN ('sending', 'completed', 'rejected') THEN
    RAISE EXCEPTION 'Invalid admin order status: %', p_new_status;
  END IF;

  UPDATE public.money_pack_orders
  SET
    status = p_new_status,
    admin_note = COALESCE(NULLIF(trim(COALESCE(p_admin_note, '')), ''), admin_note),
    approved_by = COALESCE(approved_by, v_uid),
    approved_at = COALESCE(approved_at, now()),
    completed_at = CASE WHEN p_new_status = 'completed' THEN now() ELSE completed_at END
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Money pack order not found.';
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, target_user_id, metadata)
  VALUES (
    v_uid,
    'money_pack_order_' || p_new_status,
    'money_pack_order',
    v_order.id,
    v_order.buyer_id,
    jsonb_build_object(
      'order_code', v_order.order_code,
      'pack_label', v_order.pack_label,
      'total_price_ngn', v_order.total_price_ngn,
      'status', p_new_status,
      'admin_note', v_order.admin_note
    )
  );

  RETURN v_order;
END;
$$;

-- ============================================================================
-- 8. RPC: ADMIN UPDATE PAYOUT SETTINGS (Bank Account & WhatsApp)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_update_money_pack_settings(
  p_bank_name TEXT,
  p_account_number TEXT,
  p_account_name TEXT,
  p_whatsapp_number TEXT,
  p_telegram_url TEXT DEFAULT 'https://t.me/VatarLifeStyleBySoft',
  p_is_enabled BOOLEAN DEFAULT true
)
RETURNS public.money_pack_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_settings public.money_pack_settings;
BEGIN
  IF v_uid IS NULL OR NOT public.is_active_admin(v_uid) THEN
    RAISE EXCEPTION 'Unauthorized: active administrator role required.';
  END IF;

  UPDATE public.money_pack_settings
  SET
    bank_name = trim(COALESCE(p_bank_name, '')),
    account_number = trim(COALESCE(p_account_number, '')),
    account_name = trim(COALESCE(p_account_name, '')),
    whatsapp_number = regexp_replace(trim(COALESCE(p_whatsapp_number, '')), '[^0-9]', '', 'g'),
    telegram_url = trim(COALESCE(p_telegram_url, 'https://t.me/VatarLifeStyleBySoft')),
    is_enabled = COALESCE(p_is_enabled, true),
    updated_by = v_uid
  WHERE id = 1
  RETURNING * INTO v_settings;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_uid,
    'money_pack_settings_updated',
    'money_pack_settings',
    NULL,
    jsonb_build_object(
      'bank_name', v_settings.bank_name,
      'is_enabled', v_settings.is_enabled
    )
  );

  RETURN v_settings;
END;
$$;

-- ============================================================================
-- 9. RPC: ADMIN PENDING MONEY PACK ORDER COUNT (For Live Sidebar Badge)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_pending_money_pack_count()
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
  FROM public.money_pack_orders
  WHERE status IN ('awaiting_payment', 'payment_submitted', 'sending');

  RETURN v_count;
END;
$$;

-- ============================================================================
-- 10. FUNCTION EXECUTE PERMISSIONS
-- ============================================================================
REVOKE ALL ON FUNCTION public.create_money_pack_order(TEXT, INTEGER, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_money_pack_order(TEXT, INTEGER, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.mark_money_pack_payment_submitted(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_money_pack_payment_submitted(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_money_pack_order(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_money_pack_order(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_update_money_pack_order(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_money_pack_order(UUID, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_update_money_pack_settings(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_money_pack_settings(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.get_pending_money_pack_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pending_money_pack_count() TO authenticated;
