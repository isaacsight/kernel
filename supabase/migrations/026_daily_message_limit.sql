-- Migration 026: Daily message limit for free users
-- Switches from lifetime message_count to daily tracking.
-- Lifetime message_count preserved for entity evolution scoring.

-- 1. Add daily tracking columns
ALTER TABLE user_memory
  ADD COLUMN IF NOT EXISTS daily_message_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_message_date DATE DEFAULT NULL;

-- 2. Update trigger to also protect daily columns
CREATE OR REPLACE FUNCTION protect_message_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('app.allow_message_count_update', true) IS DISTINCT FROM 'true' THEN
    IF NEW.message_count IS DISTINCT FROM OLD.message_count THEN
      RAISE EXCEPTION 'Direct modification of message_count is not allowed. Use increment_message_count() instead.';
    END IF;
    IF NEW.daily_message_count IS DISTINCT FROM OLD.daily_message_count THEN
      RAISE EXCEPTION 'Direct modification of daily_message_count is not allowed. Use increment_message_count() instead.';
    END IF;
    IF NEW.daily_message_date IS DISTINCT FROM OLD.daily_message_date THEN
      RAISE EXCEPTION 'Direct modification of daily_message_date is not allowed. Use increment_message_count() instead.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Update RPC: increment lifetime count AND daily count (auto-resets on new day)
CREATE OR REPLACE FUNCTION increment_message_count(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_daily INT;
  v_today DATE := CURRENT_DATE;
BEGIN
  -- Set bypass token so the trigger allows this update
  PERFORM set_config('app.allow_message_count_update', 'true', true);

  INSERT INTO user_memory (user_id, profile, message_count, daily_message_count, daily_message_date)
  VALUES (p_user_id, '{}'::jsonb, 1, 1, v_today)
  ON CONFLICT (user_id)
  DO UPDATE SET
    message_count = user_memory.message_count + 1,
    daily_message_count = CASE
      WHEN user_memory.daily_message_date = v_today
        THEN user_memory.daily_message_count + 1
      ELSE 1  -- new day, reset to 1
    END,
    daily_message_date = v_today
  RETURNING daily_message_count INTO v_daily;

  RETURN v_daily;
END;
$$;

REVOKE ALL ON FUNCTION increment_message_count(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION increment_message_count(UUID) FROM authenticated;
REVOKE ALL ON FUNCTION increment_message_count(UUID) FROM anon;
