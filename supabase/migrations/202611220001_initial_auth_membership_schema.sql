-- Migration 0001: Foundational schema for VATAR LIFESTYLE BY SOFT
-- Tables: public.profiles, public.memberships, public.user_roles, public.audit_logs

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Shared updated_at trigger function with locked search_path
-- Also protects created_at from client-side tampering on UPDATE.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.created_at = OLD.created_at;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================================================
-- A. PROFILES
-- =========================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  lagos_life_username TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT profiles_username_length CHECK (char_length(trim(username)) BETWEEN 3 AND 32),
  CONSTRAINT profiles_username_format CHECK (username ~ '^[A-Za-z0-9_.-]+$'),
  CONSTRAINT profiles_full_name_length CHECK (char_length(trim(full_name)) BETWEEN 2 AND 100),
  CONSTRAINT profiles_lagos_life_username_length CHECK (char_length(trim(lagos_life_username)) BETWEEN 2 AND 64)
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_unique
  ON public.profiles (lower(username));

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- B. MEMBERSHIPS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT memberships_status_check CHECK (
    status IN ('pending', 'approved', 'rejected', 'suspended')
  )
);

CREATE INDEX IF NOT EXISTS memberships_status_idx
  ON public.memberships (status);

DROP TRIGGER IF EXISTS set_memberships_updated_at ON public.memberships;
CREATE TRIGGER set_memberships_updated_at
  BEFORE UPDATE ON public.memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- C. USER ROLES
-- =========================================================
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_role_check CHECK (
    role IN ('admin', 'super_admin', 'moderator')
  ),
  CONSTRAINT user_roles_user_id_role_unique UNIQUE (user_id, role)
);

CREATE INDEX IF NOT EXISTS user_roles_user_id_idx
  ON public.user_roles (user_id);

-- =========================================================
-- D. AUDIT LOGS
-- =========================================================
-- Never store passwords, tokens, OTPs, or authentication secrets in metadata.
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_action_not_empty CHECK (char_length(trim(action)) > 0),
  CONSTRAINT audit_logs_entity_type_not_empty CHECK (char_length(trim(entity_type)) > 0)
);

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx
  ON public.audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_actor_id_idx
  ON public.audit_logs (actor_id);

CREATE INDEX IF NOT EXISTS audit_logs_target_user_id_idx
  ON public.audit_logs (target_user_id);
