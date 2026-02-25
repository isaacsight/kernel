-- Engine state: world model + lasting memory synced to Supabase
-- Separate from user_memory (which stores MemoryAgent profiles)
CREATE TABLE IF NOT EXISTS user_engine_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  world_model JSONB NOT NULL DEFAULT '{}',
  lasting_memory JSONB NOT NULL DEFAULT '{}',
  version INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_engine_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own engine state" ON user_engine_state
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
