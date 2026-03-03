-- ─── Discovery Engine ──────────────────────────────────────────────
-- Author profiles, social engagement (likes/bookmarks/follows),
-- content moderation, full-text search, discovery feed ranking.
-- ────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════
-- 1. AUTHOR PROFILES
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS author_profiles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  bio         text CHECK (char_length(bio) <= 500),
  avatar_url  text,
  pen_names   text[] DEFAULT '{}',
  is_public   boolean DEFAULT true,
  follower_count  integer DEFAULT 0,
  following_count integer DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_author_profiles_user ON author_profiles(user_id);

ALTER TABLE author_profiles ENABLE ROW LEVEL SECURITY;

-- Public read for active profiles
CREATE POLICY author_profiles_public_read ON author_profiles
  FOR SELECT TO anon, authenticated
  USING (is_public = true);

-- Owner full access
CREATE POLICY author_profiles_owner ON author_profiles
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ═══════════════════════════════════════════════════════════════════
-- 2. CONTENT ENGAGEMENT TABLES
-- ═══════════════════════════════════════════════════════════════════

-- ─── Likes ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS content_likes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id  uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(content_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_content_likes_content ON content_likes(content_id);
CREATE INDEX IF NOT EXISTS idx_content_likes_user ON content_likes(user_id);

ALTER TABLE content_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY content_likes_read ON content_likes
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY content_likes_insert ON content_likes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY content_likes_delete ON content_likes
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);


-- ─── Bookmarks ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS content_bookmarks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id  uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(content_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_content_bookmarks_content ON content_bookmarks(content_id);
CREATE INDEX IF NOT EXISTS idx_content_bookmarks_user ON content_bookmarks(user_id);

ALTER TABLE content_bookmarks ENABLE ROW LEVEL SECURITY;

-- Bookmarks are private — only the owner can see them
CREATE POLICY content_bookmarks_owner ON content_bookmarks
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ─── Author Follows ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS author_follows (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    timestamptz DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK(follower_id != following_id)
);

CREATE INDEX IF NOT EXISTS idx_author_follows_follower ON author_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_author_follows_following ON author_follows(following_id);

ALTER TABLE author_follows ENABLE ROW LEVEL SECURITY;

-- Public read for follow counts
CREATE POLICY author_follows_read ON author_follows
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY author_follows_insert ON author_follows
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY author_follows_delete ON author_follows
  FOR DELETE TO authenticated
  USING (auth.uid() = follower_id);


-- ═══════════════════════════════════════════════════════════════════
-- 3. CONTENT MODERATION
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS content_moderation (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id  uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'approved', 'flagged', 'rejected')),
  verdict     jsonb DEFAULT '{}',
  reviewed_by uuid REFERENCES auth.users(id),
  review_note text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_moderation_content ON content_moderation(content_id);
CREATE INDEX IF NOT EXISTS idx_content_moderation_status ON content_moderation(status);

ALTER TABLE content_moderation ENABLE ROW LEVEL SECURITY;

-- Content owners can see their own moderation status
CREATE POLICY content_moderation_owner_read ON content_moderation
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM content_items ci
      WHERE ci.id = content_moderation.content_id
      AND ci.user_id = auth.uid()
    )
  );


-- ═══════════════════════════════════════════════════════════════════
-- 4. NEW COLUMNS ON content_items
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS like_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bookmark_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comment_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discovery_score real DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_unlisted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS moderation_status text DEFAULT 'pending'
    CHECK (moderation_status IN ('pending', 'approved', 'flagged', 'rejected')),
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Indexes for discovery
CREATE INDEX IF NOT EXISTS idx_content_items_discovery
  ON content_items(discovery_score DESC)
  WHERE is_published = true AND is_unlisted = false AND moderation_status = 'approved';

CREATE INDEX IF NOT EXISTS idx_content_items_published_at
  ON content_items(published_at DESC)
  WHERE is_published = true AND is_unlisted = false AND moderation_status = 'approved';

CREATE INDEX IF NOT EXISTS idx_content_items_search_vector
  ON content_items USING GIN(search_vector);

CREATE INDEX IF NOT EXISTS idx_content_items_moderation
  ON content_items(moderation_status)
  WHERE is_published = true;


-- ═══════════════════════════════════════════════════════════════════
-- 5. TRIGGERS — Engagement Count Maintenance
-- ═══════════════════════════════════════════════════════════════════

-- ─── Like count ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_like_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE content_items SET like_count = like_count + 1 WHERE id = NEW.content_id;
    -- Update author follower's discovery score will happen via compute_discovery_score
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE content_items SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.content_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_update_like_count ON content_likes;
CREATE TRIGGER trg_update_like_count
  AFTER INSERT OR DELETE ON content_likes
  FOR EACH ROW EXECUTE FUNCTION update_like_count();


-- ─── Bookmark count ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_bookmark_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE content_items SET bookmark_count = bookmark_count + 1 WHERE id = NEW.content_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE content_items SET bookmark_count = GREATEST(bookmark_count - 1, 0) WHERE id = OLD.content_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_update_bookmark_count ON content_bookmarks;
CREATE TRIGGER trg_update_bookmark_count
  AFTER INSERT OR DELETE ON content_bookmarks
  FOR EACH ROW EXECUTE FUNCTION update_bookmark_count();


-- ─── Comment count ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_comment_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE content_items SET comment_count = comment_count + 1 WHERE id = NEW.content_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE content_items SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.content_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_update_comment_count ON content_comments;
CREATE TRIGGER trg_update_comment_count
  AFTER INSERT OR DELETE ON content_comments
  FOR EACH ROW EXECUTE FUNCTION update_comment_count();


-- ─── Follow count ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_follow_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE author_profiles SET follower_count = follower_count + 1
      WHERE user_id = NEW.following_id;
    UPDATE author_profiles SET following_count = following_count + 1
      WHERE user_id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE author_profiles SET follower_count = GREATEST(follower_count - 1, 0)
      WHERE user_id = OLD.following_id;
    UPDATE author_profiles SET following_count = GREATEST(following_count - 1, 0)
      WHERE user_id = OLD.follower_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_update_follow_count ON author_follows;
CREATE TRIGGER trg_update_follow_count
  AFTER INSERT OR DELETE ON author_follows
  FOR EACH ROW EXECUTE FUNCTION update_follow_count();


-- ═══════════════════════════════════════════════════════════════════
-- 6. TRIGGERS — Full-Text Search Vector
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_content_search_vector()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.meta_description, '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(COALESCE(NEW.tags, '{}'), ' ')), 'B') ||
    setweight(to_tsvector('english', COALESCE(LEFT(NEW.final_content, 5000), '')), 'C');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_search_vector ON content_items;
CREATE TRIGGER trg_update_search_vector
  BEFORE INSERT OR UPDATE OF title, meta_description, tags, final_content
  ON content_items
  FOR EACH ROW EXECUTE FUNCTION update_content_search_vector();

-- Backfill search vectors for existing published content
UPDATE content_items SET
  search_vector =
    setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(meta_description, '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(COALESCE(tags, '{}'), ' ')), 'B') ||
    setweight(to_tsvector('english', COALESCE(LEFT(final_content, 5000), '')), 'C')
WHERE is_published = true AND search_vector IS NULL;


-- ═══════════════════════════════════════════════════════════════════
-- 7. RPCs — Discovery Feed + Score Computation
-- ═══════════════════════════════════════════════════════════════════

-- ─── compute_discovery_score ──────────────────────────────────────
-- Score = (likes*3 + comments*5 + bookmarks*2 + ln(views+1)) * exp(-0.0144 * hours_old)
-- 48-hour half-life decay

CREATE OR REPLACE FUNCTION compute_discovery_score(p_content_id uuid)
RETURNS real
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_score real;
BEGIN
  SELECT
    (COALESCE(like_count, 0) * 3 +
     COALESCE(comment_count, 0) * 5 +
     COALESCE(bookmark_count, 0) * 2 +
     LN(COALESCE(view_count, 0) + 1)) *
    EXP(-0.0144 * EXTRACT(EPOCH FROM (now() - COALESCE(published_at, created_at))) / 3600.0)
  INTO v_score
  FROM content_items
  WHERE id = p_content_id;

  -- Update the stored score
  UPDATE content_items SET discovery_score = COALESCE(v_score, 0) WHERE id = p_content_id;

  RETURN COALESCE(v_score, 0);
END;
$$;

-- Revoke public access to RPC
REVOKE ALL ON FUNCTION compute_discovery_score(uuid) FROM public, anon, authenticated;


-- ─── Trigger: recompute score on engagement changes ───────────────

CREATE OR REPLACE FUNCTION recompute_discovery_on_engagement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_content_id uuid;
BEGIN
  v_content_id := COALESCE(NEW.content_id, OLD.content_id);
  PERFORM compute_discovery_score(v_content_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_discovery_likes ON content_likes;
CREATE TRIGGER trg_recompute_discovery_likes
  AFTER INSERT OR DELETE ON content_likes
  FOR EACH ROW EXECUTE FUNCTION recompute_discovery_on_engagement();

DROP TRIGGER IF EXISTS trg_recompute_discovery_bookmarks ON content_bookmarks;
CREATE TRIGGER trg_recompute_discovery_bookmarks
  AFTER INSERT OR DELETE ON content_bookmarks
  FOR EACH ROW EXECUTE FUNCTION recompute_discovery_on_engagement();

DROP TRIGGER IF EXISTS trg_recompute_discovery_comments ON content_comments;
CREATE TRIGGER trg_recompute_discovery_comments
  AFTER INSERT OR DELETE ON content_comments
  FOR EACH ROW EXECUTE FUNCTION recompute_discovery_on_engagement();


-- ─── discover_feed RPC ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION discover_feed(
  p_mode    text DEFAULT 'trending',
  p_topic   text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_search  text DEFAULT NULL,
  p_limit   integer DEFAULT 20,
  p_offset  integer DEFAULT 0
)
RETURNS TABLE (
  id              uuid,
  user_id         uuid,
  title           text,
  slug            text,
  tags            text[],
  meta_description text,
  author_name     text,
  format          text,
  published_at    timestamptz,
  view_count      integer,
  like_count      integer,
  bookmark_count  integer,
  comment_count   integer,
  discovery_score real,
  search_rank     real
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Clamp limits
  IF p_limit > 50 THEN p_limit := 50; END IF;
  IF p_offset < 0 THEN p_offset := 0; END IF;

  RETURN QUERY
  SELECT
    ci.id,
    ci.user_id,
    ci.title,
    ci.slug,
    ci.tags,
    ci.meta_description,
    ci.author_name,
    ci.format,
    ci.published_at,
    ci.view_count,
    ci.like_count,
    ci.bookmark_count,
    ci.comment_count,
    ci.discovery_score,
    CASE
      WHEN p_mode = 'search' AND p_search IS NOT NULL
      THEN ts_rank_cd(ci.search_vector, plainto_tsquery('english', p_search))
      ELSE 0::real
    END AS search_rank
  FROM content_items ci
  WHERE
    ci.is_published = true
    AND ci.is_unlisted = false
    AND ci.moderation_status = 'approved'
    -- Mode-specific filters
    AND (
      CASE p_mode
        WHEN 'personalized' THEN
          p_user_id IS NOT NULL
          AND ci.user_id IN (
            SELECT af.following_id FROM author_follows af WHERE af.follower_id = p_user_id
          )
        WHEN 'topic' THEN
          p_topic IS NOT NULL AND p_topic = ANY(ci.tags)
        WHEN 'search' THEN
          p_search IS NOT NULL
          AND ci.search_vector @@ plainto_tsquery('english', p_search)
        ELSE true  -- trending, recent
      END
    )
  ORDER BY
    CASE p_mode
      WHEN 'trending' THEN ci.discovery_score
      WHEN 'search' THEN ts_rank_cd(ci.search_vector, plainto_tsquery('english', COALESCE(p_search, '')))
      ELSE NULL
    END DESC NULLS LAST,
    CASE p_mode
      WHEN 'recent' THEN ci.published_at
      WHEN 'personalized' THEN ci.published_at
      ELSE NULL
    END DESC NULLS LAST,
    ci.published_at DESC  -- fallback sort
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Public access for feed (anyone can browse)
GRANT EXECUTE ON FUNCTION discover_feed(text, text, uuid, text, integer, integer)
  TO anon, authenticated;

-- Revoke from public schema default
REVOKE ALL ON FUNCTION discover_feed(text, text, uuid, text, integer, integer) FROM public;


-- ═══════════════════════════════════════════════════════════════════
-- 8. Backfill moderation_status for existing published content
-- ═══════════════════════════════════════════════════════════════════

-- Auto-approve all existing published content
UPDATE content_items
SET moderation_status = 'approved'
WHERE is_published = true AND moderation_status = 'pending';

-- Compute initial discovery scores for published content
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM content_items WHERE is_published = true LOOP
    PERFORM compute_discovery_score(r.id);
  END LOOP;
END;
$$;
