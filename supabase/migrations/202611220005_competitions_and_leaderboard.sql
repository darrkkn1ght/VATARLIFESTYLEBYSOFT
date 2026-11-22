-- Migration 0005: Competitions, Tournament Registrations, Results & Leaderboard
-- VATAR LIFESTYLE BY SOFT — Milestone 6
--
-- Applies cleanly on top of migrations 0001-0004 without modifying earlier migrations.
-- All tables enforce Row Level Security (RLS) with least-privilege grants.

-- =========================================================
-- 1. AUTHORIZATION HELPERS (SAFE, NON-RECURSIVE)
-- =========================================================

-- Checks whether a user has an approved membership record.
-- Caller-scoped so non-admin authenticated users can only query their own UUID.
CREATE OR REPLACE FUNCTION public.is_approved_member(p_user_id UUID)
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
    FROM public.memberships m
    WHERE m.user_id = p_user_id
      AND m.status = 'approved'
  );
END;
$$;

-- Checks whether a user holds an admin/super_admin role AND is not suspended/rejected.
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
  AND NOT EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.user_id = p_user_id
      AND m.status IN ('suspended', 'rejected')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_approved_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_approved_member(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.is_active_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_admin(UUID) TO authenticated;

-- =========================================================
-- 2. COMPETITIONS TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS public.competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  competition_type TEXT NOT NULL DEFAULT 'tournament',
  banner_image_url TEXT,
  registration_start TIMESTAMPTZ,
  registration_end TIMESTAMPTZ,
  competition_start TIMESTAMPTZ,
  competition_end TIMESTAMPTZ,
  participant_limit INTEGER,
  status TEXT NOT NULL DEFAULT 'draft',
  rules TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT competitions_title_length CHECK (char_length(trim(title)) BETWEEN 3 AND 140),
  CONSTRAINT competitions_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT competitions_type_length CHECK (char_length(trim(competition_type)) BETWEEN 2 AND 64),
  CONSTRAINT competitions_participant_limit_positive CHECK (
    participant_limit IS NULL OR participant_limit > 0
  ),
  CONSTRAINT competitions_status_check CHECK (
    status IN (
      'draft',
      'published',
      'registration_open',
      'registration_closed',
      'in_progress',
      'completed',
      'cancelled'
    )
  ),
  CONSTRAINT competitions_reg_window_valid CHECK (
    registration_start IS NULL
    OR registration_end IS NULL
    OR registration_end >= registration_start
  ),
  CONSTRAINT competitions_event_window_valid CHECK (
    competition_start IS NULL
    OR competition_end IS NULL
    OR competition_end >= competition_start
  )
);

CREATE INDEX IF NOT EXISTS competitions_status_idx
  ON public.competitions (status);

CREATE INDEX IF NOT EXISTS competitions_start_idx
  ON public.competitions (competition_start DESC NULLS LAST);

DROP TRIGGER IF EXISTS set_competitions_updated_at ON public.competitions;
CREATE TRIGGER set_competitions_updated_at
  BEFORE UPDATE ON public.competitions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 3. COMPETITION REGISTRATIONS TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS public.competition_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'registered',
  status_reason TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT competition_registrations_status_check CHECK (
    status IN ('registered', 'withdrawn', 'disqualified', 'removed')
  ),
  CONSTRAINT competition_registrations_unique UNIQUE (competition_id, user_id)
);

CREATE INDEX IF NOT EXISTS competition_registrations_comp_status_idx
  ON public.competition_registrations (competition_id, status);

CREATE INDEX IF NOT EXISTS competition_registrations_user_idx
  ON public.competition_registrations (user_id);

CREATE OR REPLACE FUNCTION public.set_registration_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.registered_at = OLD.registered_at;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_competition_registrations_updated_at ON public.competition_registrations;
CREATE TRIGGER set_competition_registrations_updated_at
  BEFORE UPDATE ON public.competition_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_registration_updated_at();

-- =========================================================
-- 4. COMPETITION RESULTS TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS public.competition_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  placement INTEGER NOT NULL,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  result_note TEXT,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT competition_results_placement_positive CHECK (placement >= 1),
  CONSTRAINT competition_results_points_non_negative CHECK (points_awarded >= 0),
  CONSTRAINT competition_results_unique_participant UNIQUE (competition_id, user_id),
  CONSTRAINT competition_results_valid_participant_fk
    FOREIGN KEY (competition_id, user_id)
    REFERENCES public.competition_registrations (competition_id, user_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS competition_results_comp_published_idx
  ON public.competition_results (competition_id, is_published, placement);

CREATE INDEX IF NOT EXISTS competition_results_user_published_idx
  ON public.competition_results (user_id, is_published);

DROP TRIGGER IF EXISTS set_competition_results_updated_at ON public.competition_results;
CREATE TRIGGER set_competition_results_updated_at
  BEFORE UPDATE ON public.competition_results
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 5. IMMUTABLE AUDIT TRIGGERS FOR ADMIN ACTIONS
-- =========================================================
CREATE OR REPLACE FUNCTION public.log_competition_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (
      actor_id, action, entity_type, entity_id, metadata
    ) VALUES (
      COALESCE(auth.uid(), NEW.created_by),
      'competition.created',
      'competition',
      NEW.id,
      jsonb_build_object('title', NEW.title, 'status', NEW.status)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.audit_logs (
        actor_id, action, entity_type, entity_id, metadata
      ) VALUES (
        auth.uid(),
        'competition.status_changed',
        'competition',
        NEW.id,
        jsonb_build_object(
          'title', NEW.title,
          'previous_status', OLD.status,
          'new_status', NEW.status
        )
      );
    ELSE
      INSERT INTO public.audit_logs (
        actor_id, action, entity_type, entity_id, metadata
      ) VALUES (
        auth.uid(),
        'competition.updated',
        'competition',
        NEW.id,
        jsonb_build_object('title', NEW.title, 'status', NEW.status)
      );
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.log_competition_change() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_competition_changed ON public.competitions;
CREATE TRIGGER on_competition_changed
  AFTER INSERT OR UPDATE ON public.competitions
  FOR EACH ROW
  EXECUTE FUNCTION public.log_competition_change();

CREATE OR REPLACE FUNCTION public.log_competition_registration_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.audit_logs (
      actor_id, action, entity_type, entity_id, target_user_id, metadata
    ) VALUES (
      COALESCE(auth.uid(), NEW.reviewed_by),
      'competition_registration.status_updated',
      'competition_registration',
      NEW.id,
      NEW.user_id,
      jsonb_build_object(
        'competition_id', NEW.competition_id,
        'previous_status', OLD.status,
        'new_status', NEW.status,
        'reason', NEW.status_reason
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.log_competition_registration_change() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_competition_registration_changed ON public.competition_registrations;
CREATE TRIGGER on_competition_registration_changed
  AFTER UPDATE ON public.competition_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.log_competition_registration_change();

CREATE OR REPLACE FUNCTION public.log_competition_result_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (
      actor_id, action, entity_type, entity_id, target_user_id, metadata
    ) VALUES (
      COALESCE(auth.uid(), NEW.recorded_by),
      'competition_result.recorded',
      'competition_result',
      NEW.id,
      NEW.user_id,
      jsonb_build_object(
        'competition_id', NEW.competition_id,
        'placement', NEW.placement,
        'points_awarded', NEW.points_awarded,
        'is_published', NEW.is_published
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (
      actor_id, action, entity_type, entity_id, target_user_id, metadata
    ) VALUES (
      COALESCE(auth.uid(), NEW.recorded_by),
      'competition_result.updated',
      'competition_result',
      NEW.id,
      NEW.user_id,
      jsonb_build_object(
        'competition_id', NEW.competition_id,
        'previous_placement', OLD.placement,
        'new_placement', NEW.placement,
        'previous_points', OLD.points_awarded,
        'new_points', NEW.points_awarded,
        'is_published', NEW.is_published
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (
      actor_id, action, entity_type, entity_id, target_user_id, metadata
    ) VALUES (
      auth.uid(),
      'competition_result.deleted',
      'competition_result',
      OLD.id,
      OLD.user_id,
      jsonb_build_object(
        'competition_id', OLD.competition_id,
        'placement', OLD.placement,
        'points_awarded', OLD.points_awarded
      )
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.log_competition_result_change() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_competition_result_changed ON public.competition_results;
CREATE TRIGGER on_competition_result_changed
  AFTER INSERT OR UPDATE OR DELETE ON public.competition_results
  FOR EACH ROW
  EXECUTE FUNCTION public.log_competition_result_change();

-- =========================================================
-- 6. ROW LEVEL SECURITY & LEAST-PRIVILEGE GRANTS
-- =========================================================
ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_results ENABLE ROW LEVEL SECURITY;

-- Competitions policies
DROP POLICY IF EXISTS "competitions_select_approved_or_admin" ON public.competitions;
CREATE POLICY "competitions_select_approved_or_admin"
  ON public.competitions
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_admin(auth.uid())
    OR (
      public.is_approved_member(auth.uid())
      AND status <> 'draft'
    )
  );

DROP POLICY IF EXISTS "competitions_insert_admin_only" ON public.competitions;
CREATE POLICY "competitions_insert_admin_only"
  ON public.competitions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_active_admin(auth.uid())
    AND (created_by IS NULL OR created_by = auth.uid())
  );

DROP POLICY IF EXISTS "competitions_update_admin_only" ON public.competitions;
CREATE POLICY "competitions_update_admin_only"
  ON public.competitions
  FOR UPDATE
  TO authenticated
  USING (public.is_active_admin(auth.uid()))
  WITH CHECK (public.is_active_admin(auth.uid()));

-- Registrations policies (writes exclusively via SECURITY DEFINER RPCs)
DROP POLICY IF EXISTS "registrations_select_own_or_admin" ON public.competition_registrations;
CREATE POLICY "registrations_select_own_or_admin"
  ON public.competition_registrations
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_active_admin(auth.uid())
  );

-- Results policies (writes exclusively via SECURITY DEFINER RPCs)
DROP POLICY IF EXISTS "results_select_published_or_admin" ON public.competition_results;
CREATE POLICY "results_select_published_or_admin"
  ON public.competition_results
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_admin(auth.uid())
    OR (
      public.is_approved_member(auth.uid())
      AND is_published = TRUE
    )
  );

-- Least-privilege table GRANTs (no grants to anon or PUBLIC)
GRANT SELECT, INSERT, UPDATE ON public.competitions TO authenticated;
GRANT SELECT ON public.competition_registrations TO authenticated;
GRANT SELECT ON public.competition_results TO authenticated;

-- =========================================================
-- 7. MEMBER & ADMIN RPC FUNCTIONS (SECURITY DEFINER)
-- =========================================================

-- A. Member self-registration with atomic capacity & window enforcement
CREATE OR REPLACE FUNCTION public.register_for_competition(p_competition_id UUID)
RETURNS public.competition_registrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_comp public.competitions;
  v_existing public.competition_registrations;
  v_active_count INTEGER;
  v_created public.competition_registrations;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to register for a competition.';
  END IF;

  IF NOT public.is_approved_member(v_user_id) THEN
    RAISE EXCEPTION 'Only approved VATAR members may register for competitions.';
  END IF;

  -- Lock competition row to prevent race conditions against participant_limit
  SELECT * INTO v_comp
  FROM public.competitions
  WHERE id = p_competition_id
  FOR UPDATE;

  IF v_comp.id IS NULL THEN
    RAISE EXCEPTION 'Competition not found.';
  END IF;

  IF v_comp.status <> 'registration_open' THEN
    RAISE EXCEPTION 'Registration is not currently open for this competition.';
  END IF;

  IF v_comp.registration_start IS NOT NULL AND now() < v_comp.registration_start THEN
    RAISE EXCEPTION 'Registration has not opened yet.';
  END IF;

  IF v_comp.registration_end IS NOT NULL AND now() > v_comp.registration_end THEN
    RAISE EXCEPTION 'The registration window for this competition has closed.';
  END IF;

  SELECT * INTO v_existing
  FROM public.competition_registrations
  WHERE competition_id = p_competition_id
    AND user_id = v_user_id;

  IF v_existing.id IS NOT NULL THEN
    IF v_existing.status = 'registered' THEN
      RAISE EXCEPTION 'You are already registered for this competition.';
    ELSE
      RAISE EXCEPTION 'Registration cannot be recreated (current status: %).', v_existing.status;
    END IF;
  END IF;

  IF v_comp.participant_limit IS NOT NULL THEN
    SELECT count(*)::INTEGER INTO v_active_count
    FROM public.competition_registrations
    WHERE competition_id = p_competition_id
      AND status = 'registered';

    IF v_active_count >= v_comp.participant_limit THEN
      RAISE EXCEPTION 'This competition has reached its participant limit.';
    END IF;
  END IF;

  INSERT INTO public.competition_registrations (competition_id, user_id, status)
  VALUES (p_competition_id, v_user_id, 'registered')
  RETURNING * INTO v_created;

  RETURN v_created;
END;
$$;

-- B. Admin participant status management (disqualify / remove / restore)
CREATE OR REPLACE FUNCTION public.admin_manage_registration(
  p_registration_id UUID,
  p_new_status TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS public.competition_registrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_updated public.competition_registrations;
BEGIN
  IF v_admin_id IS NULL OR NOT public.is_active_admin(v_admin_id) THEN
    RAISE EXCEPTION 'Unauthorized: active administrator role required.';
  END IF;

  IF p_new_status NOT IN ('registered', 'withdrawn', 'disqualified', 'removed') THEN
    RAISE EXCEPTION 'Invalid registration status: %', p_new_status;
  END IF;

  IF p_new_status IN ('disqualified', 'removed')
     AND (p_reason IS NULL OR char_length(trim(p_reason)) < 3) THEN
    RAISE EXCEPTION 'A reason (at least 3 characters) is required when disqualifying or removing a participant.';
  END IF;

  UPDATE public.competition_registrations
  SET
    status = p_new_status,
    status_reason = NULLIF(trim(COALESCE(p_reason, '')), ''),
    reviewed_by = v_admin_id
  WHERE id = p_registration_id
  RETURNING * INTO v_updated;

  IF v_updated.id IS NULL THEN
    RAISE EXCEPTION 'Registration record not found.';
  END IF;

  RETURN v_updated;
END;
$$;

-- C. Admin result recording / correction (enforces valid active participant)
CREATE OR REPLACE FUNCTION public.admin_upsert_competition_result(
  p_competition_id UUID,
  p_user_id UUID,
  p_placement INTEGER,
  p_points_awarded INTEGER,
  p_result_note TEXT DEFAULT NULL,
  p_is_published BOOLEAN DEFAULT FALSE
)
RETURNS public.competition_results
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_reg_status TEXT;
  v_result public.competition_results;
BEGIN
  IF v_admin_id IS NULL OR NOT public.is_active_admin(v_admin_id) THEN
    RAISE EXCEPTION 'Unauthorized: active administrator role required.';
  END IF;

  IF p_placement IS NULL OR p_placement < 1 THEN
    RAISE EXCEPTION 'Placement must be 1 or greater.';
  END IF;

  IF p_points_awarded IS NULL OR p_points_awarded < 0 THEN
    RAISE EXCEPTION 'Points awarded cannot be negative.';
  END IF;

  SELECT status INTO v_reg_status
  FROM public.competition_registrations
  WHERE competition_id = p_competition_id
    AND user_id = p_user_id;

  IF v_reg_status IS NULL THEN
    RAISE EXCEPTION 'Cannot record result: user is not registered in this competition.';
  END IF;

  IF v_reg_status IN ('disqualified', 'removed') THEN
    RAISE EXCEPTION 'Cannot record result for a % participant.', v_reg_status;
  END IF;

  INSERT INTO public.competition_results (
    competition_id,
    user_id,
    placement,
    points_awarded,
    result_note,
    is_published,
    recorded_by
  )
  VALUES (
    p_competition_id,
    p_user_id,
    p_placement,
    p_points_awarded,
    NULLIF(trim(COALESCE(p_result_note, '')), ''),
    COALESCE(p_is_published, FALSE),
    v_admin_id
  )
  ON CONFLICT (competition_id, user_id)
  DO UPDATE SET
    placement = EXCLUDED.placement,
    points_awarded = EXCLUDED.points_awarded,
    result_note = EXCLUDED.result_note,
    is_published = EXCLUDED.is_published,
    recorded_by = v_admin_id
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

-- D. Admin bulk publish / unpublish results for a competition
CREATE OR REPLACE FUNCTION public.admin_publish_competition_results(
  p_competition_id UUID,
  p_publish BOOLEAN DEFAULT TRUE
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_count INTEGER;
BEGIN
  IF v_admin_id IS NULL OR NOT public.is_active_admin(v_admin_id) THEN
    RAISE EXCEPTION 'Unauthorized: active administrator role required.';
  END IF;

  UPDATE public.competition_results
  SET
    is_published = COALESCE(p_publish, TRUE),
    recorded_by = v_admin_id
  WHERE competition_id = p_competition_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- E. Participant counts per competition (safe for approved members without exposing other rows)
CREATE OR REPLACE FUNCTION public.get_competition_participant_counts()
RETURNS TABLE (
  competition_id UUID,
  registered_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
BEGIN
  IF v_caller_id IS NULL
     OR (NOT public.is_approved_member(v_caller_id) AND NOT public.is_active_admin(v_caller_id)) THEN
    RAISE EXCEPTION 'Unauthorized: approved membership required.';
  END IF;

  RETURN QUERY
  SELECT
    cr.competition_id,
    count(*)::BIGINT AS registered_count
  FROM public.competition_registrations cr
  WHERE cr.status = 'registered'
  GROUP BY cr.competition_id;
END;
$$;

-- F. Published results for a competition (exposes only public VATAR username + result fields)
CREATE OR REPLACE FUNCTION public.get_competition_published_results(p_competition_id UUID)
RETURNS TABLE (
  result_id UUID,
  user_id UUID,
  username TEXT,
  placement INTEGER,
  points_awarded INTEGER,
  result_note TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
BEGIN
  IF v_caller_id IS NULL
     OR (NOT public.is_approved_member(v_caller_id) AND NOT public.is_active_admin(v_caller_id)) THEN
    RAISE EXCEPTION 'Unauthorized: approved membership required.';
  END IF;

  RETURN QUERY
  SELECT
    r.id AS result_id,
    r.user_id,
    p.username,
    r.placement,
    r.points_awarded,
    r.result_note
  FROM public.competition_results r
  JOIN public.profiles p ON p.id = r.user_id
  WHERE r.competition_id = p_competition_id
    AND r.is_published = TRUE
  ORDER BY r.placement ASC, r.points_awarded DESC, lower(p.username) ASC;
END;
$$;

-- G. Aggregated Leaderboard RPC with deterministic tie-breaking
-- Tie-breaking order:
--   1. total_points DESC
--   2. wins (placement = 1) DESC
--   3. podiums (placement <= 3) DESC
--   4. best_placement ASC
--   5. competitions_played DESC
--   6. lower(username) ASC
CREATE OR REPLACE FUNCTION public.get_leaderboard(p_competition_id UUID DEFAULT NULL)
RETURNS TABLE (
  rank_position BIGINT,
  user_id UUID,
  username TEXT,
  total_points BIGINT,
  competitions_played BIGINT,
  wins BIGINT,
  podiums BIGINT,
  best_placement INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
BEGIN
  IF v_caller_id IS NULL
     OR (NOT public.is_approved_member(v_caller_id) AND NOT public.is_active_admin(v_caller_id)) THEN
    RAISE EXCEPTION 'Unauthorized: approved membership required.';
  END IF;

  RETURN QUERY
  WITH aggregated AS (
    SELECT
      r.user_id,
      p.username,
      SUM(r.points_awarded)::BIGINT AS total_points,
      COUNT(DISTINCT r.competition_id)::BIGINT AS competitions_played,
      COUNT(*) FILTER (WHERE r.placement = 1)::BIGINT AS wins,
      COUNT(*) FILTER (WHERE r.placement <= 3)::BIGINT AS podiums,
      MIN(r.placement)::INTEGER AS best_placement
    FROM public.competition_results r
    JOIN public.competitions c ON c.id = r.competition_id
    JOIN public.profiles p ON p.id = r.user_id
    WHERE r.is_published = TRUE
      AND c.status <> 'cancelled'
      AND (p_competition_id IS NULL OR r.competition_id = p_competition_id)
    GROUP BY r.user_id, p.username
  )
  SELECT
    ROW_NUMBER() OVER (
      ORDER BY
        a.total_points DESC,
        a.wins DESC,
        a.podiums DESC,
        a.best_placement ASC,
        a.competitions_played DESC,
        lower(a.username) ASC
    )::BIGINT AS rank_position,
    a.user_id,
    a.username,
    a.total_points,
    a.competitions_played,
    a.wins,
    a.podiums,
    a.best_placement
  FROM aggregated a
  ORDER BY rank_position ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.register_for_competition(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_for_competition(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_manage_registration(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_manage_registration(UUID, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_upsert_competition_result(UUID, UUID, INTEGER, INTEGER, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_upsert_competition_result(UUID, UUID, INTEGER, INTEGER, TEXT, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_publish_competition_results(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_publish_competition_results(UUID, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.get_competition_participant_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_competition_participant_counts() TO authenticated;

REVOKE ALL ON FUNCTION public.get_competition_published_results(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_competition_published_results(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.get_leaderboard(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(UUID) TO authenticated;
