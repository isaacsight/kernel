-- Migration 027: 24-hour rolling window for free message limit
-- Instead of resetting at midnight, the 24h window starts when user
-- sends their first message after a reset. Returns reset time to frontend.

-- 1. Replace daily_message_date (DATE) with daily_window_start (TIMESTAMPTZ)
ALTER TABLE user_memory DROP COLUMN IF EXISTS daily_message_date;
ALTER TABLE user_memory ADD COLUMN IF NOT EXISTS daily_window_start TIMESTAMPTZ DEFAULT NULL;

-- 2. Update trigger to protect daily_window_start instead of daily_message_date
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
    IF NEW.daily_window_start IS DISTINCT FROM OLD.daily_window_start THEN
      RAISE EXCEPTION 'Direct modification of daily_window_start is not allowed. Use increment_message_count() instead.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Drop old RPC (return type changes from INT to JSONB)
DROP FUNCTION IF EXISTS increment_message_count(UUID);

-- 4. New RPC: 24h rolling window, returns JSONB {daily_count, resets_at}
CREATE FUNCTION increment_message_count(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_daily INT;
  v_window TIMESTAMPTZ;
  v_now TIMESTAMPTZ := now();
  v_existing_window TIMESTAMPTZ;
BEGIN
  PERFORM set_config('app.allow_message_count_update', 'true', true);

  -- Check existing window
  SELECT daily_window_start INTO v_existing_window
  FROM user_memory WHERE user_id = p_user_id;

  -- Determine if window has expired (NULL or older than 24h)
  IF v_existing_window IS NULL OR v_now >= v_existing_window + interval '24 hours' THEN
    -- New window
    INSERT INTO user_memory (user_id, profile, message_count, daily_message_count, daily_window_start)
    VALUES (p_user_id, '{}'::jsonb, 1, 1, v_now)
    ON CONFLICT (user_id)
    DO UPDATE SET
      message_count = user_memory.message_count + 1,
      daily_message_count = 1,
      daily_window_start = v_now
    RETURNING daily_message_count, daily_window_start INTO v_daily, v_window;
  ELSE
    -- Same window, increment
    UPDATE user_memory SET
      message_count = message_count + 1,
      daily_message_count = daily_message_count + 1
    WHERE user_id = p_user_id
    RETURNING daily_message_count, daily_window_start INTO v_daily, v_window;
  END IF;

  RETURN jsonb_build_object(
    'daily_count', v_daily,
    'resets_at', (v_window + interval '24 hours')::text
  );
END;
$$;

REVOKE ALL ON FUNCTION increment_message_count(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION increment_message_count(UUID) FROM authenticated;
REVOKE ALL ON FUNCTION increment_message_count(UUID) FROM anon;
