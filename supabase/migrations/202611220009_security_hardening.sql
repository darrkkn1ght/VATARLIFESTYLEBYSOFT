-- Migration 0009: Core Security & Authorization Hardening (Approved-Membership Allowlist)
-- VATAR LIFESTYLE BY SOFT — Milestone 9
--
-- Forward-only migration building on migrations 0001-0008.
-- Hardens all four role-authorization helpers (is_admin, is_super_admin,
-- has_role, and is_active_admin) to positively require an existing membership
-- record with status = 'approved'. Accounts with pending, suspended, rejected,
-- or missing membership records return FALSE across all RLS policies and RPCs.
--
-- Also freezes original announcement authorship (author_id) on UPDATE.
-- Does NOT modify earlier migrations, existing users, roles, or records.

-- =========================================================
-- 1. HARDEN public.is_admin(UUID)
-- =========================================================
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

  -- Non-admin callers may only query their own authorization state
  IF v_caller_id IS NOT NULL AND v_caller_id IS DISTINCT FROM p_user_id THEN
    IF NOT (
      EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = v_caller_id
          AND ur.role IN ('admin', 'super_admin')
      )
      AND EXISTS (
        SELECT 1
        FROM public.memberships m
        WHERE m.user_id = v_caller_id
          AND m.status = 'approved'
      )
    ) THEN
      RETURN FALSE;
    END IF;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p_user_id
      AND ur.role IN ('admin', 'super_admin')
  )
  AND EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.user_id = p_user_id
      AND m.status = 'approved'
  );
END;
$$;

-- =========================================================
-- 2. HARDEN public.is_super_admin(UUID)
-- =========================================================
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
    IF NOT public.is_admin(v_caller_id) THEN
      RETURN FALSE;
    END IF;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p_user_id
      AND ur.role = 'super_admin'
  )
  AND EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.user_id = p_user_id
      AND m.status = 'approved'
  );
END;
$$;

-- =========================================================
-- 3. HARDEN public.has_role(UUID, TEXT)
-- =========================================================
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

  IF v_caller_id IS NOT NULL AND v_caller_id IS DISTINCT FROM p_user_id THEN
    IF NOT public.is_admin(v_caller_id) THEN
      RETURN FALSE;
    END IF;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p_user_id
      AND ur.role = p_requested_role
  )
  AND EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.user_id = p_user_id
      AND m.status = 'approved'
  );
END;
$$;

-- =========================================================
-- 4. HARDEN public.is_active_admin(UUID)
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_active_admin(p_user_id UUID)
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
    IF NOT public.is_admin(v_caller_id) THEN
      RETURN FALSE;
    END IF;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p_user_id
      AND ur.role IN ('admin', 'super_admin')
  )
  AND EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.user_id = p_user_id
      AND m.status = 'approved'
  );
END;
$$;

-- =========================================================
-- 5. FREEZE ANNOUNCEMENT AUTHORSHIP ON UPDATE
-- =========================================================
-- Preserves original author_id when another active admin edits an announcement,
-- and restricts trigger function execution privileges from PUBLIC.
CREATE OR REPLACE FUNCTION public.enforce_announcement_published_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.author_id := OLD.author_id;
  END IF;

  IF NEW.status = 'published' AND NEW.published_at IS NULL THEN
    NEW.published_at := now();
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_announcement_published_at() FROM PUBLIC;

-- =========================================================
-- 6. RE-ASSERT LEAST-PRIVILEGE EXECUTE GRANTS
-- =========================================================
REVOKE ALL ON FUNCTION public.has_role(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.is_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.is_super_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.is_active_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_admin(UUID) TO authenticated;
