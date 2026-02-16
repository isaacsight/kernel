-- User memory: structured profile extracted from conversations
CREATE TABLE IF NOT EXISTS user_memory (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  profile JSONB NOT NULL DEFAULT '{}',
  message_count INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own memory" ON user_memory
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
