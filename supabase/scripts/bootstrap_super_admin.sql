-- ============================================================================
-- VATAR LIFESTYLE BY SOFT — MANUAL SUPER ADMINISTRATOR BOOTSTRAP SCRIPT
-- ============================================================================
-- Execute ONLY inside the Supabase Dashboard SQL Editor as a trusted operator.
--
-- Prerequisites:
-- 1. All migrations in supabase/migrations/ have been applied.
-- 2. The trusted administrator has already registered an account via Supabase Auth.
-- 3. Replace the placeholder UUID below with their real auth.users.id UUID.
--
-- Security:
-- - Never hardcode production UUIDs or credentials into committed files.
-- - Never auto-promote the first registered user.
-- - Role assignment and membership approval are automatically recorded in
--   public.audit_logs via database triggers.
-- ============================================================================

DO $$
DECLARE
  v_target_user_id UUID := '00000000-0000-0000-0000-000000000000'; -- REPLACE WITH TRUSTED AUTH USER UUID
BEGIN
  IF v_target_user_id = '00000000-0000-0000-0000-000000000000' THEN
    RAISE EXCEPTION 'Replace the placeholder UUID with a real auth.users.id UUID before running.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_target_user_id) THEN
    RAISE EXCEPTION 'No auth.users account exists for UUID: %', v_target_user_id;
  END IF;

  -- 1. Assign super_admin role idempotently (audited automatically by on_user_role_changed trigger)
  INSERT INTO public.user_roles (user_id, role, granted_by)
  VALUES (v_target_user_id, 'super_admin', NULL)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- 2. Approve the super_admin's membership record (audited automatically by on_membership_status_updated trigger)
  PERFORM public.review_membership(
    p_target_user_id => v_target_user_id,
    p_new_status => 'approved',
    p_review_note => 'Approved during initial super_admin bootstrap.',
    p_actor_id => v_target_user_id
  );
END;
$$;
