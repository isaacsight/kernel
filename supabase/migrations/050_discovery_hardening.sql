-- ─── Discovery Engine Hardening ────────────────────────────────
-- Fixes from security audit: prevent count manipulation,
-- add UNIQUE constraint on moderation, restrict comment updates.
-- ────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════
-- 1. Prevent owners from directly updating engagement counts
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION protect_engagement_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Preserve trigger-maintained counts — owners cannot set these directly
  NEW.like_count := OLD.like_count;
  NEW.bookmark_count := OLD.bookmark_count;
  NEW.comment_count := OLD.comment_count;
  NEW.discovery_score := OLD.discovery_score;
  -- Only allow moderation_status changes from service role (via edge functions)
  -- Regular users keep the old value
  IF current_setting('role') != 'service_role' THEN
    NEW.moderation_status := OLD.moderation_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_engagement_counts ON content_items;
CREATE TRIGGER trg_protect_engagement_counts
  BEFORE UPDATE ON content_items
  FOR EACH ROW EXECUTE FUNCTION protect_engagement_counts();


-- ═══════════════════════════════════════════════════════════════════
-- 2. Add UNIQUE constraint on content_moderation.content_id
-- ═══════════════════════════════════════════════════════════════════

-- Remove duplicates first (keep most recent)
DELETE FROM content_moderation a
USING content_moderation b
WHERE a.content_id = b.content_id
  AND a.created_at < b.created_at;

ALTER TABLE content_moderation
  ADD CONSTRAINT content_moderation_content_id_unique UNIQUE (content_id);


-- ═══════════════════════════════════════════════════════════════════
-- 3. Restrict comment UPDATE to soft-delete only
-- ═══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS content_comments_update ON content_comments;
CREATE POLICY content_comments_update ON content_comments
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (is_deleted = true);
