-- Migration 012: Shared Conversations
-- Public shareable links for conversations

CREATE TABLE IF NOT EXISTS shared_conversations (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Shared Conversation',
  messages JSONB NOT NULL DEFAULT '[]',
  view_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE shared_conversations ENABLE ROW LEVEL SECURITY;

-- Anyone can view shared conversations (public links)
CREATE POLICY "Public can view shared conversations"
  ON shared_conversations FOR SELECT
  USING (true);

-- Only the owner can insert/delete their shared conversations
CREATE POLICY "Users can create their own shared conversations"
  ON shared_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own shared conversations"
  ON shared_conversations FOR DELETE
  USING (auth.uid() = user_id);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_shared_conversations_user ON shared_conversations(user_id);
