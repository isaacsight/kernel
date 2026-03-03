-- 047: Knowledge Engine — unified personal knowledge base
-- Tables: knowledge_items, knowledge_topics, knowledge_contradictions
-- RPC: search_knowledge()
-- Extensions: pg_trgm (for fuzzy text search)

-- Ensure pg_trgm is available
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─── knowledge_topics ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS knowledge_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  domain TEXT NOT NULL DEFAULT 'general'
    CHECK (domain IN ('tech', 'personal', 'work', 'creative', 'finance', 'health', 'general')),
  parent_id UUID REFERENCES knowledge_topics(id) ON DELETE SET NULL,
  item_count INT NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_topics_user ON knowledge_topics(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_topics_parent ON knowledge_topics(parent_id) WHERE parent_id IS NOT NULL;

ALTER TABLE knowledge_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own topics" ON knowledge_topics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own topics" ON knowledge_topics FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own topics" ON knowledge_topics FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own topics" ON knowledge_topics FOR DELETE USING (auth.uid() = user_id);

-- ─── knowledge_items ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS knowledge_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Content
  content TEXT NOT NULL,
  summary TEXT,

  -- Classification
  topic TEXT,
  subtopic TEXT,
  domain TEXT NOT NULL DEFAULT 'general'
    CHECK (domain IN ('tech', 'personal', 'work', 'creative', 'finance', 'health', 'general')),
  item_type TEXT NOT NULL DEFAULT 'fact'
    CHECK (item_type IN ('fact', 'concept', 'opinion', 'procedure', 'event', 'preference', 'reference')),

  -- Provenance
  source_type TEXT NOT NULL DEFAULT 'conversation'
    CHECK (source_type IN ('conversation', 'upload', 'web_search', 'import', 'url', 'manual')),
  source_id TEXT,
  source_title TEXT,

  -- Confidence & versioning
  confidence REAL NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  version INT NOT NULL DEFAULT 1,
  superseded_by UUID REFERENCES knowledge_items(id) ON DELETE SET NULL,

  -- Temporal
  knowledge_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,

  -- Retrieval
  keywords TEXT[] NOT NULL DEFAULT '{}',
  entity_ids TEXT[] NOT NULL DEFAULT '{}',

  -- Warmth
  mention_count INT NOT NULL DEFAULT 1,
  last_accessed TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_items_user ON knowledge_items(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_topic ON knowledge_items(user_id, topic);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_domain ON knowledge_items(user_id, domain);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_keywords ON knowledge_items USING GIN (keywords);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_content_trgm ON knowledge_items USING GIN (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_confidence ON knowledge_items(user_id, confidence DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_active ON knowledge_items(user_id, created_at DESC)
  WHERE superseded_by IS NULL;

ALTER TABLE knowledge_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own items" ON knowledge_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own items" ON knowledge_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own items" ON knowledge_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own items" ON knowledge_items FOR DELETE USING (auth.uid() = user_id);

-- ─── knowledge_contradictions ──────────────────────────────────
CREATE TABLE IF NOT EXISTS knowledge_contradictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  existing_item_id UUID NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  new_content TEXT NOT NULL,
  new_source_type TEXT NOT NULL DEFAULT 'conversation'
    CHECK (new_source_type IN ('conversation', 'upload', 'web_search', 'import', 'url', 'manual')),
  resolution TEXT NOT NULL DEFAULT 'pending'
    CHECK (resolution IN ('pending', 'auto_updated', 'user_confirmed_existing', 'user_confirmed_new')),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_contradictions_user ON knowledge_contradictions(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_contradictions_pending ON knowledge_contradictions(user_id)
  WHERE resolution = 'pending';

ALTER TABLE knowledge_contradictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own contradictions" ON knowledge_contradictions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own contradictions" ON knowledge_contradictions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own contradictions" ON knowledge_contradictions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own contradictions" ON knowledge_contradictions FOR DELETE USING (auth.uid() = user_id);

-- ─── search_knowledge RPC ──────────────────────────────────────
-- Trigram similarity search ranked by content + summary + topic + confidence
CREATE OR REPLACE FUNCTION search_knowledge(
  p_user_id UUID,
  p_query TEXT,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  summary TEXT,
  topic TEXT,
  subtopic TEXT,
  domain TEXT,
  item_type TEXT,
  source_type TEXT,
  source_title TEXT,
  confidence REAL,
  keywords TEXT[],
  mention_count INT,
  created_at TIMESTAMPTZ,
  similarity REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ki.id,
    ki.content,
    ki.summary,
    ki.topic,
    ki.subtopic,
    ki.domain,
    ki.item_type,
    ki.source_type,
    ki.source_title,
    ki.confidence,
    ki.keywords,
    ki.mention_count,
    ki.created_at,
    GREATEST(
      similarity(ki.content, p_query),
      similarity(COALESCE(ki.summary, ''), p_query),
      similarity(COALESCE(ki.topic, ''), p_query) * 1.2
    )::REAL AS similarity
  FROM knowledge_items ki
  WHERE ki.user_id = p_user_id
    AND ki.superseded_by IS NULL
    AND (ki.expires_at IS NULL OR ki.expires_at > now())
    AND (
      ki.content % p_query
      OR COALESCE(ki.summary, '') % p_query
      OR COALESCE(ki.topic, '') % p_query
      OR p_query = ANY(ki.keywords)
    )
  ORDER BY similarity DESC, ki.confidence DESC, ki.mention_count DESC
  LIMIT p_limit;
END;
$$;

-- Revoke from public, only service role calls this
REVOKE ALL ON FUNCTION search_knowledge FROM public, authenticated, anon;

-- ─── Alter user_memory — add knowledge tracking columns ────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_memory' AND column_name = 'knowledge_item_count'
  ) THEN
    ALTER TABLE user_memory ADD COLUMN knowledge_item_count INT DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_memory' AND column_name = 'last_knowledge_sync'
  ) THEN
    ALTER TABLE user_memory ADD COLUMN last_knowledge_sync TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_memory' AND column_name = 'knowledge_domains'
  ) THEN
    ALTER TABLE user_memory ADD COLUMN knowledge_domains JSONB DEFAULT '{}'::JSONB;
  END IF;
END $$;
-- ─── 047: Published Content — Public Shareable Pages ───────────
--
-- Adds publishing columns to content_items for public-facing pages.
-- Enables /#/p/{slug} routes with OG tag support.

-- ─── New Columns ────────────────────────────────────────────────

ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS author_name text;

-- Unique index on slug (only for non-null slugs)
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_items_slug
  ON content_items(slug) WHERE slug IS NOT NULL;

-- Index for public queries by published status
CREATE INDEX IF NOT EXISTS idx_content_items_published
  ON content_items(is_published) WHERE is_published = true;

-- ─── Public Read RLS Policy ────────────────────────────────────
-- Permissive policy: published items readable by anyone (including anon).
-- Existing owner policies still work for authenticated owner access.

CREATE POLICY content_items_public_select ON content_items
  FOR SELECT USING (is_published = true);

-- ─── Atomic View Count Increment ───────────────────────────────

CREATE OR REPLACE FUNCTION increment_published_view_count(content_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE content_items
  SET view_count = view_count + 1
  WHERE slug = content_slug AND is_published = true;
END;
$$;

-- Revoke direct access — only callable via RPC
REVOKE ALL ON FUNCTION increment_published_view_count(text) FROM public;
REVOKE ALL ON FUNCTION increment_published_view_count(text) FROM authenticated;
REVOKE ALL ON FUNCTION increment_published_view_count(text) FROM anon;
GRANT EXECUTE ON FUNCTION increment_published_view_count(text) TO service_role;

-- ─── Content Comments ──────────────────────────────────────────
-- Authenticated users can comment on published content.

CREATE TABLE IF NOT EXISTS content_comments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id    uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id     uuid REFERENCES content_comments(id) ON DELETE CASCADE,
  body          text NOT NULL CHECK (length(body) > 0 AND length(body) <= 2000),
  author_name   text NOT NULL DEFAULT 'Anonymous',
  is_deleted    boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_comments_content ON content_comments(content_id, created_at);
CREATE INDEX idx_content_comments_user ON content_comments(user_id);
CREATE INDEX idx_content_comments_parent ON content_comments(parent_id) WHERE parent_id IS NOT NULL;

ALTER TABLE content_comments ENABLE ROW LEVEL SECURITY;

-- Anyone can read comments on published content
CREATE POLICY content_comments_public_select ON content_comments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM content_items ci WHERE ci.id = content_id AND ci.is_published = true)
  );

-- Authenticated users can insert comments on published content
CREATE POLICY content_comments_insert ON content_comments
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM content_items ci WHERE ci.id = content_id AND ci.is_published = true)
  );

-- Users can update (soft-delete) their own comments
CREATE POLICY content_comments_update ON content_comments
  FOR UPDATE USING (auth.uid() = user_id);

-- Content owners can delete any comment on their content
CREATE POLICY content_comments_delete ON content_comments
  FOR DELETE USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM content_items ci WHERE ci.id = content_id AND ci.user_id = auth.uid())
  );
