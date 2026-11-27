-- ============================================================================
-- Migration 0013: Dedicated Vendor Storefronts + Direct In-Site Order Chat
-- ============================================================================
-- Provides:
-- 1. public.vendor_stores              (dedicated vendor pages inside the site)
-- 2. public.marketplace_order_messages (live buyer <-> vendor <-> admin chat)
-- 3. Hardened SECURITY DEFINER RPCs + RLS + Realtime publication + audit_logs
-- ============================================================================

-- ============================================================================
-- 1. VENDOR STORES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.vendor_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  store_name TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  bank_name TEXT NOT NULL DEFAULT '',
  account_number TEXT NOT NULL DEFAULT '',
  account_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'approved' CHECK (
    status IN ('pending', 'approved', 'suspended')
  ),
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT vendor_stores_name_length CHECK (
    char_length(trim(store_name)) BETWEEN 2 AND 60
  ),
  CONSTRAINT vendor_stores_slug_format CHECK (
    slug ~ '^[a-z0-9][a-z0-9-]{1,48}$'
  )
);

CREATE INDEX IF NOT EXISTS vendor_stores_status_idx
  ON public.vendor_stores (status, created_at DESC);

DROP TRIGGER IF EXISTS set_vendor_stores_updated_at ON public.vendor_stores;
CREATE TRIGGER set_vendor_stores_updated_at
  BEFORE UPDATE ON public.vendor_stores
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 2. IN-SITE MARKETPLACE ORDER CHAT MESSAGES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.marketplace_order_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('buyer', 'seller', 'admin')),
  body TEXT NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketplace_order_messages_order_idx
  ON public.marketplace_order_messages (order_id, created_at ASC);

-- Enable Supabase Realtime on order chat messages idempotently
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'marketplace_order_messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_order_messages;
    END IF;
  END IF;
END;
$$;

-- ============================================================================
-- 3. RLS & LEAST-PRIVILEGE GRANTS
-- ============================================================================
ALTER TABLE public.vendor_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_order_messages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.vendor_stores FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.marketplace_order_messages FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.vendor_stores TO authenticated;
GRANT SELECT ON TABLE public.marketplace_order_messages TO authenticated;

DROP POLICY IF EXISTS "vendor_stores_select_approved_or_own_or_admin" ON public.vendor_stores;
CREATE POLICY "vendor_stores_select_approved_or_own_or_admin"
  ON public.vendor_stores
  FOR SELECT
  TO authenticated
  USING (
    (status = 'approved' AND public.is_approved_member(auth.uid()))
    OR owner_id = auth.uid()
    OR public.is_active_admin(auth.uid())
  );

DROP POLICY IF EXISTS "order_messages_select_participants_or_admin" ON public.marketplace_order_messages;
CREATE POLICY "order_messages_select_participants_or_admin"
  ON public.marketplace_order_messages
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_admin(auth.uid())
    OR (
      public.is_approved_member(auth.uid())
      AND EXISTS (
        SELECT 1
        FROM public.marketplace_orders o
        WHERE o.id = marketplace_order_messages.order_id
          AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
      )
    )
  );

-- ============================================================================
-- 4. RPC: CREATE OR UPDATE OWN VENDOR STOREFRONT
-- ============================================================================
CREATE OR REPLACE FUNCTION public.upsert_my_vendor_store(
  p_store_name TEXT,
  p_slug TEXT DEFAULT NULL,
  p_tagline TEXT DEFAULT '',
  p_description TEXT DEFAULT '',
  p_bank_name TEXT DEFAULT '',
  p_account_number TEXT DEFAULT '',
  p_account_name TEXT DEFAULT ''
)
RETURNS public.vendor_stores
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_name TEXT := trim(COALESCE(p_store_name, ''));
  v_slug TEXT := lower(regexp_replace(trim(COALESCE(p_slug, '')), '[^a-zA-Z0-9-]+', '-', 'g'));
  v_existing public.vendor_stores;
  v_store public.vendor_stores;
BEGIN
  IF v_uid IS NULL OR NOT public.is_approved_member(v_uid) THEN
    RAISE EXCEPTION 'Unauthorized: approved membership required to create a vendor store.';
  END IF;

  IF char_length(v_name) < 2 OR char_length(v_name) > 60 THEN
    RAISE EXCEPTION 'Store name must be between 2 and 60 characters.';
  END IF;

  IF v_slug = '' THEN
    v_slug := lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g'));
  END IF;
  v_slug := trim(BOTH '-' FROM left(v_slug, 48));

  IF char_length(v_slug) < 2 THEN
    v_slug := 'vendor-' || substr(replace(v_uid::text, '-', ''), 1, 6);
  END IF;

  SELECT * INTO v_existing
  FROM public.vendor_stores
  WHERE owner_id = v_uid;

  IF v_existing.id IS NOT NULL AND v_existing.status = 'suspended' THEN
    RAISE EXCEPTION 'Your vendor storefront is currently suspended by an administrator.';
  END IF;

  -- Ensure unique slug if another vendor took it
  IF EXISTS (
    SELECT 1 FROM public.vendor_stores
    WHERE slug = v_slug AND owner_id <> v_uid
  ) THEN
    v_slug := left(v_slug, 40) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4);
  END IF;

  INSERT INTO public.vendor_stores (
    owner_id,
    slug,
    store_name,
    tagline,
    description,
    bank_name,
    account_number,
    account_name,
    status
  )
  VALUES (
    v_uid,
    v_slug,
    v_name,
    left(trim(COALESCE(p_tagline, '')), 120),
    left(trim(COALESCE(p_description, '')), 800),
    left(trim(COALESCE(p_bank_name, '')), 60),
    left(trim(COALESCE(p_account_number, '')), 30),
    left(trim(COALESCE(p_account_name, '')), 80),
    'approved'
  )
  ON CONFLICT (owner_id) DO UPDATE SET
    slug = EXCLUDED.slug,
    store_name = EXCLUDED.store_name,
    tagline = EXCLUDED.tagline,
    description = EXCLUDED.description,
    bank_name = EXCLUDED.bank_name,
    account_number = EXCLUDED.account_number,
    account_name = EXCLUDED.account_name
  RETURNING * INTO v_store;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, target_user_id, metadata)
  VALUES (
    v_uid,
    'vendor_store_upserted',
    'vendor_store',
    v_store.id,
    v_uid,
    jsonb_build_object('store_name', v_store.store_name, 'slug', v_store.slug)
  );

  RETURN v_store;
END;
$$;

-- ============================================================================
-- 5. RPC: DIRECTORY OF VENDOR STOREFRONTS (With Profile & Stats)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_vendor_stores()
RETURNS TABLE (
  id UUID,
  owner_id UUID,
  slug TEXT,
  store_name TEXT,
  tagline TEXT,
  description TEXT,
  bank_name TEXT,
  account_number TEXT,
  account_name TEXT,
  status TEXT,
  is_verified BOOLEAN,
  owner_username TEXT,
  owner_full_name TEXT,
  owner_lagos_life TEXT,
  active_listings_count INTEGER,
  completed_sales_count INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_is_admin BOOLEAN := public.is_active_admin(v_uid);
BEGIN
  IF v_uid IS NULL OR (NOT public.is_approved_member(v_uid) AND NOT v_is_admin) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    vs.id,
    vs.owner_id,
    vs.slug,
    vs.store_name,
    vs.tagline,
    vs.description,
    vs.bank_name,
    vs.account_number,
    vs.account_name,
    vs.status,
    vs.is_verified,
    COALESCE(p.username, 'vendor')::TEXT AS owner_username,
    COALESCE(p.full_name, 'VATAR Vendor')::TEXT AS owner_full_name,
    COALESCE(p.lagos_life_username, '')::TEXT AS owner_lagos_life,
    (
      SELECT count(*)::INTEGER
      FROM public.marketplace_listings ml
      WHERE ml.seller_id = vs.owner_id
        AND ml.moderation_status = 'approved'
        AND ml.status = 'available'
    ) AS active_listings_count,
    (
      SELECT count(*)::INTEGER
      FROM public.marketplace_orders mo
      WHERE mo.seller_id = vs.owner_id
        AND mo.status = 'buyer_confirmed'
    ) AS completed_sales_count,
    vs.created_at,
    vs.updated_at
  FROM public.vendor_stores vs
  LEFT JOIN public.profiles p ON p.id = vs.owner_id
  WHERE v_is_admin
     OR vs.status = 'approved'
     OR vs.owner_id = v_uid
  ORDER BY vs.is_verified DESC, completed_sales_count DESC, vs.created_at DESC;
END;
$$;

-- ============================================================================
-- 6. RPC: ADMIN MODERATE / VERIFY VENDOR STORE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_moderate_vendor_store(
  p_store_id UUID,
  p_status TEXT,
  p_is_verified BOOLEAN DEFAULT NULL
)
RETURNS public.vendor_stores
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_store public.vendor_stores;
BEGIN
  IF v_uid IS NULL OR NOT public.is_active_admin(v_uid) THEN
    RAISE EXCEPTION 'Unauthorized: active administrator role required.';
  END IF;

  IF p_status NOT IN ('pending', 'approved', 'suspended') THEN
    RAISE EXCEPTION 'Invalid vendor store status: %', p_status;
  END IF;

  UPDATE public.vendor_stores
  SET
    status = p_status,
    is_verified = COALESCE(p_is_verified, is_verified)
  WHERE id = p_store_id
  RETURNING * INTO v_store;

  IF v_store.id IS NULL THEN
    RAISE EXCEPTION 'Vendor store not found.';
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, target_user_id, metadata)
  VALUES (
    v_uid,
    'vendor_store_' || p_status,
    'vendor_store',
    v_store.id,
    v_store.owner_id,
    jsonb_build_object(
      'store_name', v_store.store_name,
      'status', v_store.status,
      'is_verified', v_store.is_verified
    )
  );

  RETURN v_store;
END;
$$;

-- ============================================================================
-- 7. RPCs: IN-SITE DIRECT ORDER CHAT (Buyer <-> Vendor <-> Admin)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_order_chat_messages(
  p_order_id UUID
)
RETURNS TABLE (
  id UUID,
  order_id UUID,
  sender_id UUID,
  sender_username TEXT,
  sender_role TEXT,
  body TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_is_admin BOOLEAN := public.is_active_admin(v_uid);
  v_order public.marketplace_orders;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT * INTO v_order
  FROM public.marketplace_orders o
  WHERE o.id = p_order_id;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order not found.';
  END IF;

  IF NOT v_is_admin AND (
    NOT public.is_approved_member(v_uid)
    OR (v_order.buyer_id <> v_uid AND v_order.seller_id <> v_uid)
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only the buyer, vendor, or an admin can view this order chat.';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.order_id,
    m.sender_id,
    COALESCE(p.username, 'member')::TEXT AS sender_username,
    m.sender_role,
    m.body,
    m.created_at
  FROM public.marketplace_order_messages m
  LEFT JOIN public.profiles p ON p.id = m.sender_id
  WHERE m.order_id = p_order_id
  ORDER BY m.created_at ASC
  LIMIT 200;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_order_chat_message(
  p_order_id UUID,
  p_body TEXT
)
RETURNS public.marketplace_order_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_is_admin BOOLEAN := public.is_active_admin(v_uid);
  v_clean TEXT := trim(COALESCE(p_body, ''));
  v_order public.marketplace_orders;
  v_role TEXT;
  v_msg public.marketplace_order_messages;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF char_length(v_clean) < 1 OR char_length(v_clean) > 1000 THEN
    RAISE EXCEPTION 'Message must be between 1 and 1000 characters.';
  END IF;

  SELECT * INTO v_order
  FROM public.marketplace_orders
  WHERE id = p_order_id;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order not found.';
  END IF;

  IF v_order.buyer_id = v_uid AND public.is_approved_member(v_uid) THEN
    v_role := 'buyer';
  ELSIF v_order.seller_id = v_uid AND public.is_approved_member(v_uid) THEN
    v_role := 'seller';
  ELSIF v_is_admin THEN
    v_role := 'admin';
  ELSE
    RAISE EXCEPTION 'Unauthorized: only order participants or active admins can message in this chat.';
  END IF;

  INSERT INTO public.marketplace_order_messages (
    order_id,
    sender_id,
    sender_role,
    body
  )
  VALUES (
    p_order_id,
    v_uid,
    v_role,
    v_clean
  )
  RETURNING * INTO v_msg;

  RETURN v_msg;
END;
$$;

-- ============================================================================
-- 8. FUNCTION EXECUTE PERMISSIONS
-- ============================================================================
REVOKE ALL ON FUNCTION public.upsert_my_vendor_store(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_my_vendor_store(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.get_vendor_stores() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_vendor_stores() TO authenticated;

REVOKE ALL ON FUNCTION public.admin_moderate_vendor_store(UUID, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_moderate_vendor_store(UUID, TEXT, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.get_order_chat_messages(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_chat_messages(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.send_order_chat_message(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_order_chat_message(UUID, TEXT) TO authenticated;
