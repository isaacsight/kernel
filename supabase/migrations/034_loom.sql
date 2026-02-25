-- The Loom: Reflexive intelligence for multi-agent systems
-- Adds per-user loom state to user_memory for self-observation data
-- (outcomes, agent ledgers, synthesized patterns, self-mirror context)

ALTER TABLE user_memory
  ADD COLUMN IF NOT EXISTS loom_state JSONB DEFAULT '{}';

-- Index for querying users with active loom data
CREATE INDEX IF NOT EXISTS idx_user_memory_loom_state
  ON user_memory USING gin (loom_state)
  WHERE loom_state != '{}';
