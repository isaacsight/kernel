-- Migration 079: Morning Briefings Enhancement
-- Adds briefing_type and sections columns for proactive morning briefings.

-- 1. Add briefing_type to distinguish manual vs morning vs proactive briefings
ALTER TABLE briefings
  ADD COLUMN IF NOT EXISTS briefing_type TEXT NOT NULL DEFAULT 'manual';

COMMENT ON COLUMN briefings.briefing_type IS 'Type of briefing: manual (user-triggered), morning (scheduled), proactive (event-driven)';

-- 2. Add sections JSONB for structured briefing content
ALTER TABLE briefings
  ADD COLUMN IF NOT EXISTS sections JSONB DEFAULT NULL;

COMMENT ON COLUMN briefings.sections IS 'Structured sections: [{title, content, type}] for richer briefing display';

-- 3. Index for efficient morning briefing queries (one per user per day)
CREATE INDEX IF NOT EXISTS idx_briefings_morning
  ON briefings (user_id, briefing_type, created_at DESC)
  WHERE briefing_type = 'morning';

-- 4. Add preferred_briefing_time to user preferences
ALTER TABLE user_memory
  ADD COLUMN IF NOT EXISTS preferred_briefing_time TIME DEFAULT '08:00';

COMMENT ON COLUMN user_memory.preferred_briefing_time IS 'User preferred time for morning briefings (default 8am local)';
