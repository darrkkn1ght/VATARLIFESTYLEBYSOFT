-- Migration 0003: Row Level Security, safe authorization helpers,
-- and hardened auditable membership review function.

-- =========================================================
-- 1. SAFE AUTHORIZATION HELPER FUNCTIONS
-- =========================================================
-- SECURITY DEFINER + locked search_path prevents recursive RLS checks.
-- Caller scoping prevents ordinary authenticated users from probing
-- other users' roles via direct PostgREST RPC calls.
CREATE OR REPLACE FUNCTION public.has_role(p_user_id UUID, p_requested_role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
BEGIN
  IF p_user_id IS NULL OR p_requested_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Authenticated non-admins may only query their own roles.
  IF v_caller_id IS NOT NULL AND v_caller_id IS DISTINCT FROM p_user_id THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = v_caller_id
        AND ur.role IN ('admin', 'super_admin')
    ) THEN
      RETURN FALSE;
    END IF;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p_user_id
      AND ur.role = p_requested_role
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_caller_id IS NOT NULL AND v_caller_id IS DISTINCT FROM p_user_id THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = v_caller_id
        AND ur.role IN ('admin', 'super_admin')
    ) THEN
      RETURN FALSE;
    END IF;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p_user_id
      AND ur.role IN ('admin', 'super_admin')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_caller_id IS NOT NULL AND v_caller_id IS DISTINCT FROM p_user_id THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = v_caller_id
        AND ur.role IN ('admin', 'super_admin')
    ) THEN
      RETURN FALSE;
    END IF;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p_user_id
      AND ur.role = 'super_admin'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.has_role(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.is_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.is_super_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin(UUID) TO authenticated;

-- =========================================================
-- 2. ENABLE ROW LEVEL SECURITY ON ALL FOUR TABLES
-- =========================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 3. PROFILES POLICIES
-- =========================================================
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- =========================================================
-- 4. MEMBERSHIPS POLICIES
-- =========================================================
DROP POLICY IF EXISTS "memberships_select_own_or_admin" ON public.memberships;
CREATE POLICY "memberships_select_own_or_admin"
  ON public.memberships
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "memberships_update_admin_only" ON public.memberships;
CREATE POLICY "memberships_update_admin_only"
  ON public.memberships
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    AND user_id <> auth.uid()
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    AND user_id <> auth.uid()
    AND (reviewed_by IS NULL OR reviewed_by = auth.uid())
  );

-- =========================================================
-- 5. USER ROLES POLICIES
-- =========================================================
DROP POLICY IF EXISTS "user_roles_select_own_or_admin" ON public.user_roles;
CREATE POLICY "user_roles_select_own_or_admin"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "user_roles_insert_super_admin_only" ON public.user_roles;
CREATE POLICY "user_roles_insert_super_admin_only"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid())
    AND (granted_by IS NULL OR granted_by = auth.uid())
  );

DROP POLICY IF EXISTS "user_roles_update_super_admin_only" ON public.user_roles;
CREATE POLICY "user_roles_update_super_admin_only"
  ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (
    public.is_super_admin(auth.uid())
    AND (granted_by IS NULL OR granted_by = auth.uid())
  );

DROP POLICY IF EXISTS "user_roles_delete_super_admin_only" ON public.user_roles;
CREATE POLICY "user_roles_delete_super_admin_only"
  ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- =========================================================
-- 6. AUDIT LOGS POLICIES (IMMUTABLE)
-- =========================================================
DROP POLICY IF EXISTS "audit_logs_select_admin_only" ON public.audit_logs;
CREATE POLICY "audit_logs_select_admin_only"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "audit_logs_insert_admin_only" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_admin_only"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid())
    AND actor_id = auth.uid()
  );

-- No UPDATE or DELETE policies on public.audit_logs to keep audit records immutable.

-- =========================================================
-- 7. HARDENED AUTHORIZED MEMBERSHIP REVIEW FUNCTION
-- =========================================================
-- NOTE: Inside a SECURITY DEFINER function, `current_user` is always the
-- function owner (e.g. `postgres`), NOT the caller. Always check `auth.uid()`,
-- `session_user`, and JWT role claims instead of `current_user`.
CREATE OR REPLACE FUNCTION public.review_membership(
  p_target_user_id UUID,
  p_new_status TEXT,
  p_review_note TEXT DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL
)
RETURNS public.memberships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_uid UUID := auth.uid();
  v_jwt_role TEXT := COALESCE(current_setting('request.jwt.claim.role', true), '');
  v_actor_id UUID;
  v_updated public.memberships;
BEGIN
  IF p_new_status NOT IN ('pending', 'approved', 'rejected', 'suspended') THEN
    RAISE EXCEPTION 'Invalid membership status: %', p_new_status;
  END IF;

  IF v_caller_uid IS NOT NULL THEN
    -- Authenticated API call: strictly enforce admin role, no self-review,
    -- and ignore caller-supplied p_actor_id to prevent audit spoofing.
    IF NOT public.is_admin(v_caller_uid) THEN
      RAISE EXCEPTION 'Unauthorized: administrator role required to review memberships.';
    END IF;

    IF v_caller_uid = p_target_user_id THEN
      RAISE EXCEPTION 'Unauthorized: administrators cannot review their own membership.';
    END IF;

    v_actor_id := v_caller_uid;
  ELSIF session_user IN ('postgres', 'supabase_admin') OR v_jwt_role = 'service_role' THEN
    -- Trusted SQL Editor / service_role operational execution.
    v_actor_id := p_actor_id;
  ELSE
    RAISE EXCEPTION 'Unauthorized execution context.';
  END IF;

  UPDATE public.memberships
  SET
    status = p_new_status,
    reviewed_by = v_actor_id,
    reviewed_at = now(),
    review_note = p_review_note
  WHERE user_id = p_target_user_id
  RETURNING * INTO v_updated;

  IF v_updated.id IS NULL THEN
    RAISE EXCEPTION 'No membership record found for user_id: %', p_target_user_id;
  END IF;

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.review_membership(UUID, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_membership(UUID, TEXT, TEXT, UUID) TO authenticated;
