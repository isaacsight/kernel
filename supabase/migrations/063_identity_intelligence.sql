-- 063: Identity Intelligence — Oracle, Chronist, Sage backing columns
-- Adds user_theory, growth_state, identity_graph JSONB columns to user_memory

ALTER TABLE user_memory
  ADD COLUMN IF NOT EXISTS user_theory    JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS growth_state   JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS identity_graph JSONB DEFAULT '[]'::jsonb;

-- Index for identity graph queries (GIN for JSONB array containment)
CREATE INDEX IF NOT EXISTS idx_user_memory_identity_graph
  ON user_memory USING gin (identity_graph);

COMMENT ON COLUMN user_memory.user_theory IS 'Predictive user model: response length pref, mode, engagement prediction, topic fatigue, likely topics';
COMMENT ON COLUMN user_memory.growth_state IS 'Relationship maturity stage: dormant/germinating/growing/mature + adaptive thresholds';
COMMENT ON COLUMN user_memory.identity_graph IS 'Identity entities: values, beliefs, traits, roles, aspirations with decay timestamps';
