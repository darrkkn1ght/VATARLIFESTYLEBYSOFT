-- ============================================================================
-- Migration 0011: Auto-Approve New Member Signups (Instant Portal Entry)
-- ============================================================================
-- Allows newly registered members to enter /dashboard immediately after signup
-- without waiting for manual admin review.
--
-- Security preserved:
-- - Never grants admin or super_admin roles on signup.
-- - Admins can still Suspend or Reject any member at any time via /admin/members,
--   which immediately revokes access under RLS and authorization helpers.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_username TEXT;
  v_full_name TEXT;
  v_lagos_life_username TEXT;
BEGIN
  v_username := trim(COALESCE(NEW.raw_user_meta_data ->> 'username', ''));
  v_full_name := trim(COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''));
  v_lagos_life_username := trim(COALESCE(NEW.raw_user_meta_data ->> 'lagos_life_username', ''));

  IF char_length(v_username) < 3 OR char_length(v_username) > 32 THEN
    RAISE EXCEPTION 'Invalid registration metadata: username must be between 3 and 32 characters.';
  END IF;

  IF v_username !~ '^[A-Za-z0-9_.-]+$' THEN
    RAISE EXCEPTION 'Invalid registration metadata: username contains disallowed characters.';
  END IF;

  IF char_length(v_full_name) < 2 OR char_length(v_full_name) > 100 THEN
    RAISE EXCEPTION 'Invalid registration metadata: full_name must be between 2 and 100 characters.';
  END IF;

  IF char_length(v_lagos_life_username) < 2 OR char_length(v_lagos_life_username) > 64 THEN
    RAISE EXCEPTION 'Invalid registration metadata: lagos_life_username must be between 2 and 64 characters.';
  END IF;

  INSERT INTO public.profiles (
    id,
    username,
    full_name,
    lagos_life_username
  )
  VALUES (
    NEW.id,
    v_username,
    v_full_name,
    v_lagos_life_username
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.memberships (
    user_id,
    status,
    reviewed_at,
    review_note
  )
  VALUES (
    NEW.id,
    'approved',
    now(),
    'Auto-approved on registration.'
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
