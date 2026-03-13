-- K:BOT Cloud Memory — sync learning data across machines
--
-- Stores patterns, solutions, profile, and knowledge for kbot CLI users.
-- Synced via kbot-engine /sync endpoint.

CREATE TABLE IF NOT EXISTS kbot_memory (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  patterns JSONB NOT NULL DEFAULT '{}',
  solutions JSONB NOT NULL DEFAULT '{}',
  profile JSONB NOT NULL DEFAULT '{}',
  knowledge JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: users can only read/write their own memory
ALTER TABLE kbot_memory ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY kbot_memory_own ON kbot_memory
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_kbot_memory_updated ON kbot_memory(updated_at DESC);

-- Grant service role full access (for edge function)
GRANT ALL ON kbot_memory TO service_role;
-- Grant authenticated users access through RLS
GRANT SELECT, INSERT, UPDATE ON kbot_memory TO authenticated;
