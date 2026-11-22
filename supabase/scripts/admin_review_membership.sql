-- ============================================================================
-- VATAR LIFESTYLE BY SOFT — AUTHORIZED MEMBERSHIP REVIEW OPERATIONS
-- ============================================================================
-- Use this script in the Supabase SQL Editor to approve, reject, or suspend
-- member applications while the full Admin Dashboard UI is pending.
--
-- Every call to public.review_membership() automatically updates reviewed_by,
-- reviewed_at, and writes an immutable entry to public.audit_logs.
-- ============================================================================

-- 1. Inspect pending membership applications
SELECT
  m.user_id,
  p.username,
  p.full_name,
  p.lagos_life_username,
  m.status,
  m.created_at
FROM public.memberships m
JOIN public.profiles p ON p.id = m.user_id
WHERE m.status = 'pending'
ORDER BY m.created_at ASC;

-- 2. Approve a member (replace both UUIDs before running)
-- SELECT * FROM public.review_membership(
--   p_target_user_id => 'TARGET_MEMBER_UUID',
--   p_new_status     => 'approved',
--   p_review_note    => 'Application verified and approved.',
--   p_actor_id       => 'ADMIN_AUTH_USER_UUID'
-- );

-- 3. Reject a member
-- SELECT * FROM public.review_membership(
--   p_target_user_id => 'TARGET_MEMBER_UUID',
--   p_new_status     => 'rejected',
--   p_review_note    => 'Application did not meet onboarding requirements.',
--   p_actor_id       => 'ADMIN_AUTH_USER_UUID'
-- );

-- 4. Suspend a member
-- SELECT * FROM public.review_membership(
--   p_target_user_id => 'TARGET_MEMBER_UUID',
--   p_new_status     => 'suspended',
--   p_review_note    => 'Account restricted pending moderation review.',
--   p_actor_id       => 'ADMIN_AUTH_USER_UUID'
-- );

-- 5. Verify recent audit logs
-- SELECT created_at, actor_id, action, target_user_id, metadata
-- FROM public.audit_logs
-- ORDER BY created_at DESC
-- LIMIT 25;
