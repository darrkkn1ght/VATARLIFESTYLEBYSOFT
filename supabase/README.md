# Supabase Setup & Administration Guide

This directory contains the versioned PostgreSQL migrations and operational scripts for **VATAR LIFESTYLE BY SOFT** (Milestone 3).

## 1. Apply Migrations in Order

Run the following SQL files in order inside the **Supabase Dashboard → SQL Editor** (or via the Supabase CLI once linked to your project):

1. `supabase/migrations/202611220001_initial_auth_membership_schema.sql`
2. `supabase/migrations/202611220002_registration_trigger_and_audit.sql`
3. `supabase/migrations/202611220003_rls_and_authorization.sql`

## 2. Configure Frontend Environment

Copy `.env.example` to `.env` in the project root and supply your project's public credentials:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

Never place a Supabase `service_role` key in `.env` or any frontend code.

## 3. Bootstrap the First Super Administrator

1. Register the trusted administrator's account normally via `/register`.
2. Locate their user UUID in **Supabase Dashboard → Authentication → Users**.
3. Open `supabase/scripts/bootstrap_super_admin.sql` in the Supabase SQL Editor, replace the placeholder UUID with the trusted user's UUID, and execute it.

## 4. Review Member Applications (Pre-Dashboard)

Until the full Admin Dashboard UI is built in a later milestone, use `supabase/scripts/admin_review_membership.sql` in the Supabase SQL Editor to inspect pending applications and call `public.review_membership(...)`. Every status change is automatically logged to `public.audit_logs`.
