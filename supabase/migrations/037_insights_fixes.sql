-- Migration 037: Insights feature fixes
-- 1. Create missing increment_insight_usage() RPC
-- 2. Add user_id FK to evaluation_conversations for cascade delete

-- ─── 1. increment_insight_usage RPC ─────────────────────────────
-- Called by evaluate-chat to track which insights get injected into prompts.
-- Was referenced in code but never created — times_used was always 0.

CREATE OR REPLACE FUNCTION increment_insight_usage(p_insight_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE agent_insights SET times_used = times_used + 1 WHERE id = p_insight_id;
END;
$$;

REVOKE ALL ON FUNCTION increment_insight_usage(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION increment_insight_usage(TEXT) FROM authenticated;
REVOKE ALL ON FUNCTION increment_insight_usage(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION increment_insight_usage(TEXT) TO service_role;

-- ─── 2. Add user_id to evaluation_conversations ────────────────
-- Previously only stored email (string) with no FK — orphaned rows on account deletion.

ALTER TABLE evaluation_conversations
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_evaluation_conversations_user
  ON evaluation_conversations(user_id);
