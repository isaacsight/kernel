-- Conversation Folders: let users organize conversations into named folders.
-- One level deep only (no nesting). Deleting a folder orphans its conversations.

CREATE TABLE IF NOT EXISTS conversation_folders (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_folders_user ON conversation_folders(user_id, sort_order);

ALTER TABLE conversation_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own folders"
  ON conversation_folders FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add folder_id to conversations (nullable = uncategorized)
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS folder_id TEXT
  REFERENCES conversation_folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_folder ON conversations(folder_id);
