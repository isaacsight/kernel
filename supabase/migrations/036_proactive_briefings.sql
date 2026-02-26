-- Migration 036: Proactive Briefings v2
-- Adds infrastructure for Kernel to reach out first based on mirror/convergence data.
-- Pro-only feature: generates "Kernel noticed..." insights from agent facets.

-- 1. Add last_proactive_at to user_memory for per-user throttling (max 1 per 24h)
ALTER TABLE user_memory
  ADD COLUMN IF NOT EXISTS last_proactive_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN user_memory.last_proactive_at IS 'Timestamp of last proactive notification sent to this user';

-- 2. Add proactive_trigger to notifications to mark proactive notifications
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS proactive_trigger TEXT DEFAULT NULL;

COMMENT ON COLUMN notifications.proactive_trigger IS 'Non-null for proactive notifications — contains the generated insight text';

-- 3. Expand notifications type CHECK to include "proactive"
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('info', 'reminder', 'task_complete', 'briefing', 'goal', 'refund', 'proactive'));

-- 4. Partial index for efficient lookup of proactive notifications
CREATE INDEX IF NOT EXISTS idx_notifications_proactive
  ON notifications (user_id, created_at DESC)
  WHERE proactive_trigger IS NOT NULL;
