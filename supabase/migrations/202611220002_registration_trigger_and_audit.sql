-- Migration 0002: Automatic registration trigger, membership review metadata enforcement,
-- and immutable audit logging for membership and role changes.

-- =========================================================
-- 1. AUTOMATIC REGISTRATION RECORDS TRIGGER
-- =========================================================
-- Creates public.profiles and public.memberships (always 'pending')
-- whenever a new auth.users account is inserted.
-- Never trusts frontend-supplied roles or membership status values.
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
    status
  )
  VALUES (
    NEW.id,
    'pending'
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- 2. ENFORCE MEMBERSHIP REVIEW METADATA ON AUTHENTICATED UPDATES
-- =========================================================
-- Ensures authenticated admins cannot spoof reviewed_by or stale reviewed_at
-- when updating public.memberships directly.
CREATE OR REPLACE FUNCTION public.enforce_membership_review_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.reviewed_by := auth.uid();
    NEW.reviewed_at := now();
  ELSIF NEW.reviewed_at IS NULL AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.reviewed_at := now();
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_membership_review_metadata() FROM PUBLIC;

DROP TRIGGER IF EXISTS enforce_memberships_review_metadata ON public.memberships;
CREATE TRIGGER enforce_memberships_review_metadata
  BEFORE UPDATE ON public.memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_membership_review_metadata();

-- =========================================================
-- 3. IMMUTABLE MEMBERSHIP STATUS AUDIT TRIGGER
-- =========================================================
CREATE OR REPLACE FUNCTION public.log_membership_review_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status)
     OR (OLD.review_note IS DISTINCT FROM NEW.review_note)
     OR (OLD.reviewed_by IS DISTINCT FROM NEW.reviewed_by) THEN
    INSERT INTO public.audit_logs (
      actor_id,
      action,
      entity_type,
      entity_id,
      target_user_id,
      metadata
    )
    VALUES (
      COALESCE(auth.uid(), NEW.reviewed_by),
      'membership.status_updated',
      'membership',
      NEW.id,
      NEW.user_id,
      jsonb_build_object(
        'previous_status', OLD.status,
        'new_status', NEW.status,
        'review_note', NEW.review_note
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.log_membership_review_change() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_membership_status_updated ON public.memberships;
CREATE TRIGGER on_membership_status_updated
  AFTER UPDATE ON public.memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.log_membership_review_change();

-- =========================================================
-- 4. IMMUTABLE USER ROLE ASSIGNMENT AUDIT TRIGGER
-- =========================================================
CREATE OR REPLACE FUNCTION public.log_user_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (
      actor_id,
      action,
      entity_type,
      entity_id,
      target_user_id,
      metadata
    )
    VALUES (
      COALESCE(auth.uid(), NEW.granted_by),
      'role.granted',
      'user_role',
      NEW.id,
      NEW.user_id,
      jsonb_build_object('role', NEW.role)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.role IS DISTINCT FROM NEW.role THEN
      INSERT INTO public.audit_logs (
        actor_id,
        action,
        entity_type,
        entity_id,
        target_user_id,
        metadata
      )
      VALUES (
        COALESCE(auth.uid(), NEW.granted_by),
        'role.updated',
        'user_role',
        NEW.id,
        NEW.user_id,
        jsonb_build_object('previous_role', OLD.role, 'new_role', NEW.role)
      );
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (
      actor_id,
      action,
      entity_type,
      entity_id,
      target_user_id,
      metadata
    )
    VALUES (
      auth.uid(),
      'role.revoked',
      'user_role',
      OLD.id,
      OLD.user_id,
      jsonb_build_object('role', OLD.role)
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.log_user_role_change() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_user_role_changed ON public.user_roles;
CREATE TRIGGER on_user_role_changed
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_user_role_change();
