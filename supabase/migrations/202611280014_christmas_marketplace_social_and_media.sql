-- ============================================================================
-- Migration 0014: Christmas Real-Life + Digital Marketplace, Photos, Locations,
-- Likes, Comments, Favorites, Public Feed & Public Reviews Access
-- ============================================================================

-- 1. EXPAND MARKETPLACE LISTINGS (Real-Life + Digital Categories, Photos & Store Location)
ALTER TABLE public.marketplace_listings
  ADD COLUMN IF NOT EXISTS location TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS image_urls TEXT[] NOT NULL DEFAULT '{}'::TEXT[];

ALTER TABLE public.marketplace_listings
  DROP CONSTRAINT IF EXISTS marketplace_listings_category_check;

ALTER TABLE public.marketplace_listings
  ADD CONSTRAINT marketplace_listings_category_check CHECK (
    category IN (
      'lagos_life_funds',
      'digital_goods',
      'digital_services',
      'cars_vehicles',
      'fashion_clothing',
      'gadgets_electronics',
      'real_estate',
      'community_products'
    )
  );

-- Also allow Vendor Storefronts to display their physical / city store location
ALTER TABLE public.vendor_stores
  ADD COLUMN IF NOT EXISTS store_location TEXT NOT NULL DEFAULT '';

-- 2. CREATE PUBLIC SUPABASE STORAGE BUCKET FOR PRODUCT PHOTOS
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'marketplace-media',
  'marketplace-media',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

DROP POLICY IF EXISTS "marketplace_media_public_read" ON storage.objects;
CREATE POLICY "marketplace_media_public_read"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'marketplace-media');

DROP POLICY IF EXISTS "marketplace_media_member_upload" ON storage.objects;
CREATE POLICY "marketplace_media_member_upload"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'marketplace-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "marketplace_media_member_delete" ON storage.objects;
CREATE POLICY "marketplace_media_member_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'marketplace-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3. SOCIAL ENGAGEMENT TABLES: LIKES, FAVORITES & PUBLIC PRODUCT COMMENTS
CREATE TABLE IF NOT EXISTS public.marketplace_listing_likes (
  listing_id UUID NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (listing_id, user_id)
);

CREATE INDEX IF NOT EXISTS marketplace_listing_likes_listing_idx
  ON public.marketplace_listing_likes (listing_id);

ALTER TABLE public.marketplace_listing_likes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.marketplace_listing_likes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.marketplace_listing_likes TO anon, authenticated;

DROP POLICY IF EXISTS "listing_likes_public_read" ON public.marketplace_listing_likes;
CREATE POLICY "listing_likes_public_read"
  ON public.marketplace_listing_likes
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS public.marketplace_listing_favorites (
  listing_id UUID NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (listing_id, user_id)
);

CREATE INDEX IF NOT EXISTS marketplace_listing_favorites_user_idx
  ON public.marketplace_listing_favorites (user_id, created_at DESC);

ALTER TABLE public.marketplace_listing_favorites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.marketplace_listing_favorites FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.marketplace_listing_favorites TO authenticated;

DROP POLICY IF EXISTS "listing_favorites_own_read" ON public.marketplace_listing_favorites;
CREATE POLICY "listing_favorites_own_read"
  ON public.marketplace_listing_favorites
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.marketplace_listing_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 600),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketplace_listing_comments_listing_idx
  ON public.marketplace_listing_comments (listing_id, created_at ASC);

ALTER TABLE public.marketplace_listing_comments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.marketplace_listing_comments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.marketplace_listing_comments TO anon, authenticated;

DROP POLICY IF EXISTS "listing_comments_public_read" ON public.marketplace_listing_comments;
CREATE POLICY "listing_comments_public_read"
  ON public.marketplace_listing_comments
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 4. UPGRADE VENDOR STOREFRONTS RPCs (Include Store Location + Public Read Access)
DROP FUNCTION IF EXISTS public.upsert_my_vendor_store(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.upsert_my_vendor_store(
  p_store_name TEXT,
  p_slug TEXT DEFAULT NULL,
  p_tagline TEXT DEFAULT '',
  p_description TEXT DEFAULT '',
  p_bank_name TEXT DEFAULT '',
  p_account_number TEXT DEFAULT '',
  p_account_name TEXT DEFAULT '',
  p_store_location TEXT DEFAULT ''
)
RETURNS public.vendor_stores
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_clean_name TEXT := trim(COALESCE(p_store_name, ''));
  v_raw_slug TEXT;
  v_clean_slug TEXT;
  v_store public.vendor_stores;
BEGIN
  IF v_uid IS NULL OR (NOT public.is_approved_member(v_uid) AND NOT public.is_active_admin(v_uid)) THEN
    RAISE EXCEPTION 'Unauthorized: approved VATAR membership required to create a vendor store.';
  END IF;

  IF char_length(v_clean_name) < 3 OR char_length(v_clean_name) > 60 THEN
    RAISE EXCEPTION 'Store name must be between 3 and 60 characters.';
  END IF;

  v_raw_slug := COALESCE(NULLIF(trim(p_slug), ''), v_clean_name);
  v_clean_slug := lower(regexp_replace(v_raw_slug, '[^a-zA-Z0-9]+', '-', 'g'));
  v_clean_slug := trim(both '-' from v_clean_slug);
  IF char_length(v_clean_slug) < 3 THEN
    v_clean_slug := 'vendor-' || substr(replace(v_uid::text, '-', ''), 1, 8);
  END IF;
  v_clean_slug := left(v_clean_slug, 48);

  IF EXISTS (
    SELECT 1 FROM public.vendor_stores s
    WHERE lower(s.slug) = v_clean_slug AND s.owner_id <> v_uid
  ) THEN
    v_clean_slug := left(v_clean_slug, 40) || '-' || substr(replace(v_uid::text, '-', ''), 1, 4);
  END IF;

  INSERT INTO public.vendor_stores (
    owner_id,
    slug,
    store_name,
    tagline,
    description,
    bank_name,
    account_number,
    account_name,
    store_location,
    status,
    is_verified
  )
  VALUES (
    v_uid,
    v_clean_slug,
    v_clean_name,
    left(trim(COALESCE(p_tagline, '')), 120),
    left(trim(COALESCE(p_description, '')), 800),
    left(trim(COALESCE(p_bank_name, '')), 80),
    left(trim(COALESCE(p_account_number, '')), 30),
    left(trim(COALESCE(p_account_name, '')), 100),
    left(trim(COALESCE(p_store_location, '')), 120),
    'approved',
    public.is_active_admin(v_uid)
  )
  ON CONFLICT (owner_id) DO UPDATE SET
    slug = EXCLUDED.slug,
    store_name = EXCLUDED.store_name,
    tagline = EXCLUDED.tagline,
    description = EXCLUDED.description,
    bank_name = EXCLUDED.bank_name,
    account_number = EXCLUDED.account_number,
    account_name = EXCLUDED.account_name,
    store_location = EXCLUDED.store_location
  RETURNING * INTO v_store;

  RETURN v_store;
END;
$$;

DROP FUNCTION IF EXISTS public.get_vendor_stores();
CREATE OR REPLACE FUNCTION public.get_vendor_stores()
RETURNS TABLE (
  id UUID,
  owner_id UUID,
  slug TEXT,
  store_name TEXT,
  tagline TEXT,
  description TEXT,
  bank_name TEXT,
  account_number TEXT,
  account_name TEXT,
  store_location TEXT,
  status TEXT,
  is_verified BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  owner_username TEXT,
  owner_full_name TEXT,
  owner_lagos_life TEXT,
  active_listings_count BIGINT,
  completed_sales_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_is_admin BOOLEAN := CASE WHEN v_uid IS NOT NULL THEN public.is_active_admin(v_uid) ELSE false END;
BEGIN
  RETURN QUERY
  SELECT
    vs.id,
    vs.owner_id,
    vs.slug,
    vs.store_name,
    vs.tagline,
    vs.description,
    vs.bank_name,
    vs.account_number,
    vs.account_name,
    vs.store_location,
    vs.status,
    vs.is_verified,
    vs.created_at,
    vs.updated_at,
    COALESCE(p.username, 'vendor')::TEXT AS owner_username,
    COALESCE(p.full_name, vs.store_name)::TEXT AS owner_full_name,
    COALESCE(p.lagos_life_username, '')::TEXT AS owner_lagos_life,
    (
      SELECT COUNT(*)
      FROM public.marketplace_listings ml
      WHERE ml.seller_id = vs.owner_id
        AND ml.moderation_status = 'approved'
        AND ml.status = 'available'
    ) AS active_listings_count,
    (
      SELECT COUNT(*)
      FROM public.marketplace_orders mo
      WHERE mo.seller_id = vs.owner_id
        AND mo.status = 'buyer_confirmed'
    ) AS completed_sales_count
  FROM public.vendor_stores vs
  LEFT JOIN public.profiles p ON p.id = vs.owner_id
  WHERE vs.status = 'approved' OR vs.owner_id = v_uid OR v_is_admin
  ORDER BY vs.is_verified DESC, completed_sales_count DESC, vs.created_at DESC;
END;
$$;

-- 5. UPGRADE MARKETPLACE LISTING RPCs (Photos, Location, Admin Auto-Approval & Rich Social Counts)
DROP FUNCTION IF EXISTS public.get_marketplace_listings(TEXT);
CREATE OR REPLACE FUNCTION public.get_marketplace_listings(
  p_category TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  seller_id UUID,
  seller_username TEXT,
  category TEXT,
  title TEXT,
  description TEXT,
  price_amount NUMERIC,
  price_currency TEXT,
  game_currency_amount BIGINT,
  seller_contact_note TEXT,
  location TEXT,
  image_urls TEXT[],
  status TEXT,
  moderation_status TEXT,
  moderation_note TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  likes_count BIGINT,
  comments_count BIGINT,
  viewer_has_liked BOOLEAN,
  viewer_has_favorited BOOLEAN,
  vendor_store_name TEXT,
  vendor_store_slug TEXT,
  vendor_is_verified BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_is_admin BOOLEAN := CASE WHEN v_caller_id IS NOT NULL THEN public.is_active_admin(v_caller_id) ELSE false END;
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.seller_id,
    COALESCE(p.username, 'seller')::TEXT AS seller_username,
    l.category,
    l.title,
    l.description,
    l.price_amount,
    l.price_currency,
    l.game_currency_amount,
    l.seller_contact_note,
    l.location,
    l.image_urls,
    l.status,
    l.moderation_status,
    l.moderation_note,
    l.created_at,
    l.updated_at,
    (SELECT COUNT(*) FROM public.marketplace_listing_likes lk WHERE lk.listing_id = l.id) AS likes_count,
    (SELECT COUNT(*) FROM public.marketplace_listing_comments cm WHERE cm.listing_id = l.id) AS comments_count,
    CASE
      WHEN v_caller_id IS NULL THEN false
      ELSE EXISTS (
        SELECT 1 FROM public.marketplace_listing_likes lk2
        WHERE lk2.listing_id = l.id AND lk2.user_id = v_caller_id
      )
    END AS viewer_has_liked,
    CASE
      WHEN v_caller_id IS NULL THEN false
      ELSE EXISTS (
        SELECT 1 FROM public.marketplace_listing_favorites fv
        WHERE fv.listing_id = l.id AND fv.user_id = v_caller_id
      )
    END AS viewer_has_favorited,
    vs.store_name AS vendor_store_name,
    vs.slug AS vendor_store_slug,
    COALESCE(vs.is_verified, false) AS vendor_is_verified
  FROM public.marketplace_listings l
  LEFT JOIN public.profiles p ON p.id = l.seller_id
  LEFT JOIN public.vendor_stores vs ON vs.owner_id = l.seller_id AND vs.status = 'approved'
  WHERE (p_category IS NULL OR l.category = p_category)
    AND (
      v_is_admin
      OR (v_caller_id IS NOT NULL AND l.seller_id = v_caller_id)
      OR (l.moderation_status = 'approved' AND (v_caller_id IS NOT NULL OR l.status = 'available'))
    )
  ORDER BY l.created_at DESC;
END;
$$;

DROP FUNCTION IF EXISTS public.create_marketplace_listing(TEXT, TEXT, TEXT, NUMERIC, TEXT, BIGINT, TEXT);
CREATE OR REPLACE FUNCTION public.create_marketplace_listing(
  p_category TEXT,
  p_title TEXT,
  p_description TEXT,
  p_price_amount NUMERIC,
  p_price_currency TEXT DEFAULT 'NGN',
  p_game_currency_amount BIGINT DEFAULT NULL,
  p_seller_contact_note TEXT DEFAULT NULL,
  p_location TEXT DEFAULT '',
  p_image_urls TEXT[] DEFAULT '{}'::TEXT[]
)
RETURNS public.marketplace_listings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_admin BOOLEAN;
  v_clean_images TEXT[];
  v_created public.marketplace_listings;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  v_is_admin := public.is_active_admin(v_user_id);

  IF NOT v_is_admin AND NOT public.is_approved_member(v_user_id) THEN
    RAISE EXCEPTION 'Only approved VATAR members may create marketplace listings.';
  END IF;

  IF p_category = 'lagos_life_funds' AND (p_game_currency_amount IS NULL OR p_game_currency_amount <= 0) THEN
    RAISE EXCEPTION 'Lagos Life game funds listings must specify a positive game currency amount.';
  END IF;

  SELECT COALESCE(array_agg(u), '{}'::TEXT[])
  INTO v_clean_images
  FROM (
    SELECT trim(elem) AS u
    FROM unnest(COALESCE(p_image_urls, '{}'::TEXT[])) AS elem
    WHERE trim(elem) <> ''
    LIMIT 4
  ) sub;

  INSERT INTO public.marketplace_listings (
    seller_id,
    category,
    title,
    description,
    price_amount,
    price_currency,
    game_currency_amount,
    seller_contact_note,
    location,
    image_urls,
    status,
    moderation_status,
    moderated_by,
    moderated_at
  )
  VALUES (
    v_user_id,
    p_category,
    trim(p_title),
    trim(p_description),
    p_price_amount,
    upper(trim(COALESCE(p_price_currency, 'NGN'))),
    p_game_currency_amount,
    NULLIF(trim(COALESCE(p_seller_contact_note, '')), ''),
    left(trim(COALESCE(p_location, '')), 120),
    v_clean_images,
    'available',
    CASE WHEN v_is_admin THEN 'approved' ELSE 'pending' END,
    CASE WHEN v_is_admin THEN v_user_id ELSE NULL END,
    CASE WHEN v_is_admin THEN now() ELSE NULL END
  )
  RETURNING * INTO v_created;

  RETURN v_created;
END;
$$;

DROP FUNCTION IF EXISTS public.update_own_marketplace_listing(UUID, TEXT, TEXT, NUMERIC, TEXT, BIGINT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.update_own_marketplace_listing(
  p_listing_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_price_amount NUMERIC,
  p_price_currency TEXT DEFAULT 'NGN',
  p_game_currency_amount BIGINT DEFAULT NULL,
  p_seller_contact_note TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'available',
  p_location TEXT DEFAULT '',
  p_image_urls TEXT[] DEFAULT '{}'::TEXT[]
)
RETURNS public.marketplace_listings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_admin BOOLEAN;
  v_existing public.marketplace_listings;
  v_updated public.marketplace_listings;
  v_clean_title TEXT := trim(COALESCE(p_title, ''));
  v_clean_desc TEXT := trim(COALESCE(p_description, ''));
  v_clean_currency TEXT := upper(trim(COALESCE(p_price_currency, 'NGN')));
  v_clean_contact TEXT := NULLIF(trim(COALESCE(p_seller_contact_note, '')), '');
  v_clean_location TEXT := left(trim(COALESCE(p_location, '')), 120);
  v_clean_images TEXT[];
  v_committed_qty BIGINT := 0;
  v_content_changed BOOLEAN;
  v_next_moderation TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  v_is_admin := public.is_active_admin(v_user_id);

  IF NOT v_is_admin AND NOT public.is_approved_member(v_user_id) THEN
    RAISE EXCEPTION 'Only approved VATAR members may update listings.';
  END IF;

  SELECT * INTO v_existing
  FROM public.marketplace_listings
  WHERE id = p_listing_id
  FOR UPDATE;

  IF v_existing.id IS NULL THEN
    RAISE EXCEPTION 'Listing not found.';
  END IF;

  IF v_existing.seller_id <> v_user_id AND NOT v_is_admin THEN
    RAISE EXCEPTION 'You may only edit your own listings.';
  END IF;

  IF v_existing.moderation_status IN ('rejected', 'removed') AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Listings with moderation status "%" cannot be edited.', v_existing.moderation_status;
  END IF;

  IF p_status NOT IN ('available', 'unavailable', 'sold') THEN
    RAISE EXCEPTION 'Invalid listing status: %', p_status;
  END IF;

  IF v_existing.category = 'lagos_life_funds' THEN
    IF p_game_currency_amount IS NULL OR p_game_currency_amount <= 0 THEN
      RAISE EXCEPTION 'Lagos Life game funds listings must specify a positive game currency amount.';
    END IF;

    SELECT COALESCE(SUM(COALESCE(o.requested_game_currency_amount, 0)), 0)::BIGINT
    INTO v_committed_qty
    FROM public.marketplace_orders o
    WHERE o.listing_id = v_existing.id
      AND o.status IN ('requested', 'accepted', 'in_progress', 'seller_marked_sent', 'disputed', 'buyer_confirmed');

    IF p_game_currency_amount < v_committed_qty THEN
      RAISE EXCEPTION 'Cannot reduce game-currency quantity below already reserved/completed order volume (%).', v_committed_qty;
    END IF;
  END IF;

  SELECT COALESCE(array_agg(u), '{}'::TEXT[])
  INTO v_clean_images
  FROM (
    SELECT trim(elem) AS u
    FROM unnest(COALESCE(p_image_urls, '{}'::TEXT[])) AS elem
    WHERE trim(elem) <> ''
    LIMIT 4
  ) sub;

  v_content_changed :=
    (v_clean_title IS DISTINCT FROM v_existing.title)
    OR (v_clean_desc IS DISTINCT FROM v_existing.description)
    OR (p_price_amount IS DISTINCT FROM v_existing.price_amount)
    OR (v_clean_currency IS DISTINCT FROM v_existing.price_currency)
    OR (p_game_currency_amount IS DISTINCT FROM v_existing.game_currency_amount)
    OR (v_clean_contact IS DISTINCT FROM v_existing.seller_contact_note)
    OR (v_clean_location IS DISTINCT FROM v_existing.location)
    OR (v_clean_images IS DISTINCT FROM v_existing.image_urls);

  IF v_is_admin THEN
    v_next_moderation := 'approved';
  ELSIF v_existing.moderation_status = 'approved' AND v_content_changed THEN
    v_next_moderation := 'pending';
  ELSE
    v_next_moderation := v_existing.moderation_status;
  END IF;

  UPDATE public.marketplace_listings
  SET
    title = v_clean_title,
    description = v_clean_desc,
    price_amount = p_price_amount,
    price_currency = v_clean_currency,
    game_currency_amount = p_game_currency_amount,
    seller_contact_note = v_clean_contact,
    location = v_clean_location,
    image_urls = v_clean_images,
    status = p_status,
    moderation_status = v_next_moderation
  WHERE id = p_listing_id
  RETURNING * INTO v_updated;

  RETURN v_updated;
END;
$$;

-- Allow active administrators (Soft) to approve any listing including their own
CREATE OR REPLACE FUNCTION public.admin_moderate_listing(
  p_listing_id UUID,
  p_moderation_status TEXT,
  p_moderation_note TEXT DEFAULT NULL
)
RETURNS public.marketplace_listings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_existing public.marketplace_listings;
  v_updated public.marketplace_listings;
BEGIN
  IF v_admin_id IS NULL OR NOT public.is_active_admin(v_admin_id) THEN
    RAISE EXCEPTION 'Unauthorized: active administrator role required.';
  END IF;

  IF p_moderation_status NOT IN ('pending', 'approved', 'rejected', 'removed') THEN
    RAISE EXCEPTION 'Invalid moderation status: %', p_moderation_status;
  END IF;

  SELECT * INTO v_existing
  FROM public.marketplace_listings
  WHERE id = p_listing_id
  FOR UPDATE;

  IF v_existing.id IS NULL THEN
    RAISE EXCEPTION 'Listing not found.';
  END IF;

  UPDATE public.marketplace_listings
  SET
    moderation_status = p_moderation_status,
    moderation_note = NULLIF(trim(COALESCE(p_moderation_note, '')), ''),
    moderated_by = v_admin_id,
    moderated_at = now(),
    status = CASE
      WHEN p_moderation_status IN ('rejected', 'removed') THEN 'unavailable'
      ELSE status
    END
  WHERE id = p_listing_id
  RETURNING * INTO v_updated;

  INSERT INTO public.audit_logs (
    actor_id, action, entity_type, entity_id, target_user_id, metadata
  ) VALUES (
    v_admin_id,
    'marketplace_listing.moderated',
    'marketplace_listing',
    v_updated.id,
    v_updated.seller_id,
    jsonb_build_object(
      'title', v_updated.title,
      'previous_status', v_existing.moderation_status,
      'new_status', v_updated.moderation_status,
      'note', v_updated.moderation_note
    )
  );

  RETURN v_updated;
END;
$$;

-- 6. SOCIAL INTERACTION RPCs (Likes, Favorites & Public Comments)
CREATE OR REPLACE FUNCTION public.toggle_marketplace_listing_like(
  p_listing_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_liked BOOLEAN;
  v_count BIGINT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to like listings.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.marketplace_listing_likes
    WHERE listing_id = p_listing_id AND user_id = v_uid
  ) THEN
    DELETE FROM public.marketplace_listing_likes
    WHERE listing_id = p_listing_id AND user_id = v_uid;
    v_liked := false;
  ELSE
    INSERT INTO public.marketplace_listing_likes (listing_id, user_id)
    VALUES (p_listing_id, v_uid)
    ON CONFLICT DO NOTHING;
    v_liked := true;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.marketplace_listing_likes
  WHERE listing_id = p_listing_id;

  RETURN jsonb_build_object('liked', v_liked, 'likes_count', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_marketplace_listing_favorite(
  p_listing_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_fav BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to save favorites.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.marketplace_listing_favorites
    WHERE listing_id = p_listing_id AND user_id = v_uid
  ) THEN
    DELETE FROM public.marketplace_listing_favorites
    WHERE listing_id = p_listing_id AND user_id = v_uid;
    v_fav := false;
  ELSE
    INSERT INTO public.marketplace_listing_favorites (listing_id, user_id)
    VALUES (p_listing_id, v_uid)
    ON CONFLICT DO NOTHING;
    v_fav := true;
  END IF;

  RETURN jsonb_build_object('favorited', v_fav);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_marketplace_listing_comments(
  p_listing_id UUID
)
RETURNS TABLE (
  id UUID,
  listing_id UUID,
  user_id UUID,
  username TEXT,
  full_name TEXT,
  body TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.listing_id,
    c.user_id,
    COALESCE(p.username, 'member')::TEXT AS username,
    COALESCE(p.full_name, 'VATAR Member')::TEXT AS full_name,
    c.body,
    c.created_at
  FROM public.marketplace_listing_comments c
  LEFT JOIN public.profiles p ON p.id = c.user_id
  WHERE c.listing_id = p_listing_id
  ORDER BY c.created_at ASC
  LIMIT 100;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_marketplace_listing_comment(
  p_listing_id UUID,
  p_body TEXT
)
RETURNS public.marketplace_listing_comments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_clean TEXT := trim(COALESCE(p_body, ''));
  v_comment public.marketplace_listing_comments;
BEGIN
  IF v_uid IS NULL OR (NOT public.is_approved_member(v_uid) AND NOT public.is_active_admin(v_uid)) THEN
    RAISE EXCEPTION 'Sign in as an approved member to comment.';
  END IF;

  IF char_length(v_clean) < 1 OR char_length(v_clean) > 600 THEN
    RAISE EXCEPTION 'Comment must be between 1 and 600 characters.';
  END IF;

  INSERT INTO public.marketplace_listing_comments (listing_id, user_id, body)
  VALUES (p_listing_id, v_uid, v_clean)
  RETURNING * INTO v_comment;

  RETURN v_comment;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_marketplace_listing_comment(
  p_comment_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_comment public.marketplace_listing_comments;
  v_seller_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT * INTO v_comment
  FROM public.marketplace_listing_comments
  WHERE id = p_comment_id;

  IF v_comment.id IS NULL THEN
    RETURN false;
  END IF;

  SELECT seller_id INTO v_seller_id
  FROM public.marketplace_listings
  WHERE id = v_comment.listing_id;

  IF v_comment.user_id <> v_uid AND v_seller_id <> v_uid AND NOT public.is_active_admin(v_uid) THEN
    RAISE EXCEPTION 'Unauthorized to delete this comment.';
  END IF;

  DELETE FROM public.marketplace_listing_comments WHERE id = p_comment_id;
  RETURN true;
END;
$$;

-- 7. PUBLIC & AUTHENTICATED GRANTS (Visitors Can View Listings, Vendors, Comments & Reviews!)
REVOKE ALL ON FUNCTION public.get_marketplace_listings(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_marketplace_listings(TEXT) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_vendor_stores() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_vendor_stores() TO anon, authenticated;

REVOKE ALL ON FUNCTION public.upsert_my_vendor_store(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_my_vendor_store(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.create_marketplace_listing(TEXT, TEXT, TEXT, NUMERIC, TEXT, BIGINT, TEXT, TEXT, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_marketplace_listing(TEXT, TEXT, TEXT, NUMERIC, TEXT, BIGINT, TEXT, TEXT, TEXT[]) TO authenticated;

REVOKE ALL ON FUNCTION public.update_own_marketplace_listing(UUID, TEXT, TEXT, NUMERIC, TEXT, BIGINT, TEXT, TEXT, TEXT, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_own_marketplace_listing(UUID, TEXT, TEXT, NUMERIC, TEXT, BIGINT, TEXT, TEXT, TEXT, TEXT[]) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_moderate_listing(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_moderate_listing(UUID, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.toggle_marketplace_listing_like(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_marketplace_listing_like(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.toggle_marketplace_listing_favorite(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_marketplace_listing_favorite(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.get_marketplace_listing_comments(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_marketplace_listing_comments(UUID) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.add_marketplace_listing_comment(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_marketplace_listing_comment(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.delete_marketplace_listing_comment(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_marketplace_listing_comment(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.get_public_reviews(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_reviews(INTEGER) TO anon, authenticated;
