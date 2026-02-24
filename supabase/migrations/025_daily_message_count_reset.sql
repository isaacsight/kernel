-- Migration 025: Daily message count reset for free-tier users
-- Bug fix: message_count was only ever incremented, never reset.
-- Free users were getting 10 messages TOTAL instead of 10 PER DAY.
--
-- Adds a count_date column to track which UTC day the count belongs to.
-- When a new day starts, the counter resets to 1 instead of incrementing.

-- Add count_date column (defaults to today so existing rows are treated as "today")
ALTER TABLE user_memory
  ADD COLUMN IF NOT EXISTS count_date DATE NOT NULL DEFAULT CURRENT_DATE;

-- Replace the increment function with daily-reset-aware version
CREATE OR REPLACE FUNCTION increment_message_count(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
  v_today DATE := CURRENT_DATE;
BEGIN
  -- Upsert the row. If it doesn't exist, create with count=1 and today's date.
  INSERT INTO user_memory (user_id, profile, message_count, count_date)
  VALUES (p_user_id, '{}'::jsonb, 1, v_today)
  ON CONFLICT (user_id)
  DO UPDATE SET
    -- If the stored date is before today, reset count to 1; otherwise increment.
    message_count = CASE
      WHEN user_memory.count_date < v_today THEN 1
      ELSE user_memory.message_count + 1
    END,
    count_date = v_today
  RETURNING message_count INTO v_count;

  RETURN v_count;
END;
$$;

-- Maintain security: only callable via service role
REVOKE ALL ON FUNCTION increment_message_count(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION increment_message_count(UUID) FROM authenticated;
REVOKE ALL ON FUNCTION increment_message_count(UUID) FROM anon;
