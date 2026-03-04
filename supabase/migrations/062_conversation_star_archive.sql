-- 062: Add starred_at and archived_at columns to conversations
-- Backwards-compatible: existing conversations stay null (not starred, not archived)

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS starred_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;

-- Partial index for fast starred queries (only non-null rows)
CREATE INDEX IF NOT EXISTS idx_conversations_starred
  ON conversations (user_id, starred_at DESC)
  WHERE starred_at IS NOT NULL;

-- Partial index for active (non-archived) conversations
CREATE INDEX IF NOT EXISTS idx_conversations_active
  ON conversations (user_id, updated_at DESC)
  WHERE archived_at IS NULL;

-- Partial index for archived conversations
CREATE INDEX IF NOT EXISTS idx_conversations_archived
  ON conversations (user_id, archived_at DESC)
  WHERE archived_at IS NOT NULL;
