-- 043_max_tier.sql
-- Adds Kernel Max tier: $49/month, $490/year
-- Calendar-month fair use limit (6000 msgs), internal monitoring flag at 3000

-- 1a. Expand plan CHECK constraint on subscriptions
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_plan_check
  CHECK (plan IN ('pro_monthly', 'pro_annual', 'max_monthly', 'max_annual'));

-- 1b. Add usage_flag column to user_memory (internal monitoring)
ALTER TABLE user_memory ADD COLUMN IF NOT EXISTS usage_flag TEXT DEFAULT NULL;

-- 1c. check_max_fair_use — calendar-month counter for Max users
-- Returns {monthly_count, resets_at, blocked}
CREATE OR REPLACE FUNCTION check_max_fair_use(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
  v_window_start TIMESTAMPTZ;
  v_month_start TIMESTAMPTZ := date_trunc('month', NOW());
  v_next_month TIMESTAMPTZ := date_trunc('month', NOW() + INTERVAL '1 month');
BEGIN
  SELECT monthly_message_count, monthly_window_start
  INTO v_count, v_window_start
  FROM user_memory
  WHERE user_id = p_user_id;

  -- No record yet — brand new user, no usage
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'monthly_count', 0,
      'resets_at', v_next_month,
      'blocked', false
    );
  END IF;

  -- Window is in a previous month — counter has logically reset
  IF v_window_start IS NULL OR date_trunc('month', v_window_start) < v_month_start THEN
    RETURN jsonb_build_object(
      'monthly_count', 0,
      'resets_at', v_next_month,
      'blocked', false
    );
  END IF;

  RETURN jsonb_build_object(
    'monthly_count', COALESCE(v_count, 0),
    'resets_at', v_next_month,
    'blocked', COALESCE(v_count, 0) >= 6000
  );
END;
$$;

-- 1d. increment_max_message_count — atomic increment with calendar-month auto-reset
-- Grace period: if window_start IS NULL (new signup), set window to start of NEXT month
CREATE OR REPLACE FUNCTION increment_max_message_count(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_month_start TIMESTAMPTZ := date_trunc('month', NOW());
  v_next_month TIMESTAMPTZ := date_trunc('month', NOW() + INTERVAL '1 month');
  v_new_count INT;
BEGIN
  SELECT monthly_window_start INTO v_window_start
  FROM user_memory WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    -- Brand new user — insert with grace period (counter starts next month)
    INSERT INTO user_memory (user_id, monthly_message_count, monthly_window_start)
    VALUES (p_user_id, 0, v_next_month)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN jsonb_build_object('monthly_count', 0, 'resets_at', v_next_month);
  END IF;

  -- Grace period: window_start is NULL → first partial month free
  IF v_window_start IS NULL THEN
    UPDATE user_memory
    SET monthly_window_start = v_next_month, monthly_message_count = 0
    WHERE user_id = p_user_id;
    RETURN jsonb_build_object('monthly_count', 0, 'resets_at', v_next_month);
  END IF;

  -- Window is in a previous month → reset counter for new month
  IF date_trunc('month', v_window_start) < v_month_start THEN
    UPDATE user_memory
    SET monthly_message_count = 1, monthly_window_start = v_month_start
    WHERE user_id = p_user_id
    RETURNING monthly_message_count INTO v_new_count;
    RETURN jsonb_build_object('monthly_count', v_new_count, 'resets_at', v_next_month);
  END IF;

  -- Same month — increment
  UPDATE user_memory
  SET monthly_message_count = monthly_message_count + 1
  WHERE user_id = p_user_id
  RETURNING monthly_message_count INTO v_new_count;

  RETURN jsonb_build_object('monthly_count', v_new_count, 'resets_at', v_next_month);
END;
$$;

-- 1e. set_usage_flag — sets usage_flag on user_memory
CREATE OR REPLACE FUNCTION set_usage_flag(p_user_id UUID, p_flag TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_memory SET usage_flag = p_flag WHERE user_id = p_user_id;
END;
$$;

-- 1f. Revoke direct execution from public roles
REVOKE EXECUTE ON FUNCTION check_max_fair_use(UUID) FROM public, authenticated, anon;
REVOKE EXECUTE ON FUNCTION increment_max_message_count(UUID) FROM public, authenticated, anon;
REVOKE EXECUTE ON FUNCTION set_usage_flag(UUID, TEXT) FROM public, authenticated, anon;
