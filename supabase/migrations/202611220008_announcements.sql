-- Migration 0008: Announcements & Member Read Tracking
-- VATAR LIFESTYLE BY SOFT — Milestone 8
--
-- Forward-only migration building on migrations 0001-0007.
-- Uses existing authorization helpers: public.is_approved_member(), public.is_active_admin(),
-- public.set_updated_at(), and public.audit_logs.
-- Does NOT modify earlier migrations or weaken existing RLS/grants.

-- =========================================================
-- 1. ANNOUNCEMENTS TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  priority TEXT NOT NULL DEFAULT 'normal',
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT announcements_title_length CHECK (
    char_length(trim(title)) BETWEEN 3 AND 160
  ),
  CONSTRAINT announcements_slug_format CHECK (
    slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  CONSTRAINT announcements_content_length CHECK (
    char_length(trim(content)) BETWEEN 10 AND 10000
  ),
  CONSTRAINT announcements_category_check CHECK (
    category IN ('general', 'competitions', 'marketplace', 'important')
  ),
  CONSTRAINT announcements_priority_check CHECK (
    priority IN ('low', 'normal', 'high', 'urgent')
  ),
  CONSTRAINT announcements_status_check CHECK (
    status IN ('draft', 'published', 'archived')
  )
);

CREATE INDEX IF NOT EXISTS announcements_published_feed_idx
  ON public.announcements (status, is_pinned DESC, published_at DESC NULLS LAST, created_at DESC);

CREATE INDEX IF NOT EXISTS announcements_category_status_idx
  ON public.announcements (category, status);

DROP TRIGGER IF EXISTS set_announcements_updated_at ON public.announcements;
CREATE TRIGGER set_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Automatically populate published_at on first publish if not supplied
CREATE OR REPLACE FUNCTION public.enforce_announcement_published_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'published' AND NEW.published_at IS NULL THEN
    NEW.published_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_announcements_published_at ON public.announcements;
CREATE TRIGGER enforce_announcements_published_at
  BEFORE INSERT OR UPDATE ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_announcement_published_at();

-- =========================================================
-- 2. ANNOUNCEMENT READS TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS public.announcement_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT announcement_reads_unique UNIQUE (announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS announcement_reads_user_idx
  ON public.announcement_reads (user_id, read_at DESC);

-- =========================================================
-- 3. IMMUTABLE AUDIT LOGGING FOR ADMIN ANNOUNCEMENT ACTIONS
-- =========================================================
CREATE OR REPLACE FUNCTION public.log_announcement_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_action TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (
      actor_id, action, entity_type, entity_id, metadata
    ) VALUES (
      COALESCE(auth.uid(), NEW.author_id),
      'announcement.created',
      'announcement',
      NEW.id,
      jsonb_build_object(
        'title', NEW.title,
        'category', NEW.category,
        'priority', NEW.priority,
        'status', NEW.status,
        'is_pinned', NEW.is_pinned
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_action := CASE NEW.status
        WHEN 'published' THEN 'announcement.published'
        WHEN 'draft' THEN 'announcement.unpublished'
        WHEN 'archived' THEN 'announcement.archived'
        ELSE 'announcement.status_changed'
      END;
    ELSE
      v_action := 'announcement.updated';
    END IF;

    INSERT INTO public.audit_logs (
      actor_id, action, entity_type, entity_id, metadata
    ) VALUES (
      auth.uid(),
      v_action,
      'announcement',
      NEW.id,
      jsonb_build_object(
        'title', NEW.title,
        'previous_status', OLD.status,
        'new_status', NEW.status,
        'is_pinned', NEW.is_pinned,
        'priority', NEW.priority
      )
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.log_announcement_change() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_announcement_changed ON public.announcements;
CREATE TRIGGER on_announcement_changed
  AFTER INSERT OR UPDATE ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.log_announcement_change();

-- =========================================================
-- 4. ROW LEVEL SECURITY & LEAST-PRIVILEGE GRANTS
-- =========================================================
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;

-- Announcements policies
-- Members may ONLY read published announcements (never draft or archived).
DROP POLICY IF EXISTS "announcements_select_published_or_admin" ON public.announcements;
CREATE POLICY "announcements_select_published_or_admin"
  ON public.announcements
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_admin(auth.uid())
    OR (
      public.is_approved_member(auth.uid())
      AND status = 'published'
      AND (published_at IS NULL OR published_at <= now())
    )
  );

DROP POLICY IF EXISTS "announcements_insert_admin_only" ON public.announcements;
CREATE POLICY "announcements_insert_admin_only"
  ON public.announcements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_active_admin(auth.uid())
    AND (author_id IS NULL OR author_id = auth.uid())
  );

DROP POLICY IF EXISTS "announcements_update_admin_only" ON public.announcements;
CREATE POLICY "announcements_update_admin_only"
  ON public.announcements
  FOR UPDATE
  TO authenticated
  USING (public.is_active_admin(auth.uid()))
  WITH CHECK (public.is_active_admin(auth.uid()));

-- Announcement reads policies (members manage strictly their own read records)
DROP POLICY IF EXISTS "announcement_reads_select_own" ON public.announcement_reads;
CREATE POLICY "announcement_reads_select_own"
  ON public.announcement_reads
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "announcement_reads_insert_own_published" ON public.announcement_reads;
CREATE POLICY "announcement_reads_insert_own_published"
  ON public.announcement_reads
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (public.is_approved_member(auth.uid()) OR public.is_active_admin(auth.uid()))
    AND EXISTS (
      SELECT 1
      FROM public.announcements a
      WHERE a.id = announcement_reads.announcement_id
        AND a.status = 'published'
        AND (a.published_at IS NULL OR a.published_at <= now())
    )
  );

-- Least-privilege table GRANTs (no grants to anon or PUBLIC)
GRANT SELECT, INSERT, UPDATE ON public.announcements TO authenticated;
GRANT SELECT, INSERT ON public.announcement_reads TO authenticated;

-- =========================================================
-- 5. SAFE READ & TRACKING RPCS (SECURITY DEFINER)
-- =========================================================

-- A. Fetch published announcements with author VATAR username and caller read state
CREATE OR REPLACE FUNCTION public.get_member_announcements(p_category TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  title TEXT,
  slug TEXT,
  content TEXT,
  category TEXT,
  priority TEXT,
  is_pinned BOOLEAN,
  published_at TIMESTAMPTZ,
  author_username TEXT,
  is_read BOOLEAN,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL
     OR (NOT public.is_approved_member(v_user_id) AND NOT public.is_active_admin(v_user_id)) THEN
    RAISE EXCEPTION 'Approved VATAR membership required.';
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.title,
    a.slug,
    a.content,
    a.category,
    a.priority,
    a.is_pinned,
    a.published_at,
    COALESCE(p.username, 'vatar_admin') AS author_username,
    (ar.id IS NOT NULL) AS is_read,
    ar.read_at,
    a.created_at
  FROM public.announcements a
  LEFT JOIN public.profiles p ON p.id = a.author_id
  LEFT JOIN public.announcement_reads ar
    ON ar.announcement_id = a.id
   AND ar.user_id = v_user_id
  WHERE a.status = 'published'
    AND (a.published_at IS NULL OR a.published_at <= now())
    AND (p_category IS NULL OR a.category = p_category)
  ORDER BY
    a.is_pinned DESC,
    a.published_at DESC NULLS LAST,
    a.created_at DESC;
END;
$$;

-- B. Idempotently mark a published announcement as read for the authenticated member
CREATE OR REPLACE FUNCTION public.mark_announcement_read(p_announcement_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL
     OR (NOT public.is_approved_member(v_user_id) AND NOT public.is_active_admin(v_user_id)) THEN
    RAISE EXCEPTION 'Approved VATAR membership required.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.announcements a
    WHERE a.id = p_announcement_id
      AND a.status = 'published'
      AND (a.published_at IS NULL OR a.published_at <= now())
  ) THEN
    RAISE EXCEPTION 'Published announcement not found.';
  END IF;

  INSERT INTO public.announcement_reads (announcement_id, user_id)
  VALUES (p_announcement_id, v_user_id)
  ON CONFLICT (announcement_id, user_id) DO NOTHING;

  RETURN TRUE;
END;
$$;

-- C. Unread published announcements count for the authenticated member
CREATE OR REPLACE FUNCTION public.get_unread_announcements_count()
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_count INTEGER;
BEGIN
  IF v_user_id IS NULL
     OR (NOT public.is_approved_member(v_user_id) AND NOT public.is_active_admin(v_user_id)) THEN
    RETURN 0;
  END IF;

  SELECT count(*)::INTEGER INTO v_count
  FROM public.announcements a
  WHERE a.status = 'published'
    AND (a.published_at IS NULL OR a.published_at <= now())
    AND NOT EXISTS (
      SELECT 1
      FROM public.announcement_reads ar
      WHERE ar.announcement_id = a.id
        AND ar.user_id = v_user_id
    );

  RETURN COALESCE(v_count, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.get_member_announcements(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_member_announcements(TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.mark_announcement_read(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_announcement_read(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.get_unread_announcements_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_unread_announcements_count() TO authenticated;
