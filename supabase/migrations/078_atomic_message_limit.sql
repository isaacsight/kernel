-- Migration 078: Atomic message limit check + increment
-- Fixes race condition where rapid concurrent requests all pass the read-only
-- check_message_limit before any chargeMessageOnSuccess increments the counter.
--
-- New approach: check_and_increment_message atomically checks the limit
-- AND increments in one transaction. Returns allowed=false if at/over limit.

CREATE OR REPLACE FUNCTION check_and_increment_message(p_user_id UUID, p_limit INT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_daily INT;
  v_window TIMESTAMPTZ;
  v_now TIMESTAMPTZ := now();
BEGIN
  PERFORM set_config('app.allow_message_count_update', 'true', true);

  -- Lock the row to prevent concurrent reads
  SELECT daily_message_count, daily_window_start INTO v_daily, v_window
  FROM user_memory WHERE user_id = p_user_id
  FOR UPDATE;

  -- No row yet = first message ever
  IF NOT FOUND THEN
    INSERT INTO user_memory (user_id, profile, message_count, daily_message_count, daily_window_start)
    VALUES (p_user_id, '{}'::jsonb, 1, 1, v_now)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN jsonb_build_object('allowed', true, 'daily_count', 1, 'resets_at', (v_now + interval '24 hours')::text);
  END IF;

  -- Window expired = reset and allow
  IF v_window IS NULL OR v_now >= v_window + interval '24 hours' THEN
    UPDATE user_memory SET
      message_count = message_count + 1,
      daily_message_count = 1,
      daily_window_start = v_now
    WHERE user_id = p_user_id
    RETURNING daily_message_count, daily_window_start INTO v_daily, v_window;
    RETURN jsonb_build_object('allowed', true, 'daily_count', v_daily, 'resets_at', (v_window + interval '24 hours')::text);
  END IF;

  -- At or over limit = reject
  IF v_daily >= p_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'daily_count', v_daily,
      'resets_at', (v_window + interval '24 hours')::text
    );
  END IF;

  -- Under limit = increment and allow
  UPDATE user_memory SET
    message_count = message_count + 1,
    daily_message_count = daily_message_count + 1
  WHERE user_id = p_user_id
  RETURNING daily_message_count, daily_window_start INTO v_daily, v_window;

  RETURN jsonb_build_object(
    'allowed', true,
    'daily_count', v_daily,
    'resets_at', (v_window + interval '24 hours')::text
  );
END;
$$;

REVOKE ALL ON FUNCTION check_and_increment_message(UUID, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION check_and_increment_message(UUID, INT) FROM authenticated;
REVOKE ALL ON FUNCTION check_and_increment_message(UUID, INT) FROM anon;
