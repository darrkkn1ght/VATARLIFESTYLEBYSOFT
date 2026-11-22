-- Migration 0004: Least-privilege table-level GRANTs for the `authenticated` role.
--
-- PostgreSQL evaluates table-level privileges BEFORE Row Level Security (RLS).
-- All existing RLS policies on profiles, memberships, user_roles, and audit_logs
-- remain fully enabled and unchanged.
--
-- Notes:
-- - `anon` and `PUBLIC` receive NO grants.
-- - `authenticated` receives NO direct INSERT, UPDATE, or DELETE on memberships,
--   user_roles, or audit_logs; membership reviews go exclusively through the
--   SECURITY DEFINER RPC `public.review_membership()`, and audit records are
--   written by SECURITY DEFINER database triggers.

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, UPDATE ON public.profiles TO authenticated;

GRANT SELECT ON public.memberships TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
