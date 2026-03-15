-- Migration: Pro tier billing ($15/month, 200 msgs/month, $0.10 overage)
-- Replaces the 3-tier system (free/pro/max) with 2-tier (free/pro).

-- Add monthly tracking columns to user_memory (if not exist)
ALTER TABLE user_memory ADD COLUMN IF NOT EXISTS monthly_message_count INT DEFAULT 0;
ALTER TABLE user_memory ADD COLUMN IF NOT EXISTS monthly_window_start TIMESTAMPTZ DEFAULT now();

-- ── Atomic monthly message check + increment ──────────────────
CREATE OR REPLACE FUNCTION check_and_increment_monthly_message(
  p_user_id UUID,
  p_limit INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
  v_window TIMESTAMPTZ;
  v_now TIMESTAMPTZ := now();
  v_month_start TIMESTAMPTZ;
BEGIN
  -- Calculate first day of current month
  v_month_start := date_trunc('month', v_now);

  -- Lock row
  SELECT monthly_message_count, monthly_window_start
    INTO v_count, v_window
    FROM user_memory
   WHERE user_id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO user_memory (user_id, monthly_message_count, monthly_window_start)
    VALUES (p_user_id, 1, v_month_start)
    ON CONFLICT (user_id) DO UPDATE
      SET monthly_message_count = 1, monthly_window_start = v_month_start;
    RETURN jsonb_build_object('allowed', true, 'monthly_count', 1, 'resets_at', (v_month_start + interval '1 month')::TEXT);
  END IF;

  -- New month? Reset.
  IF v_window < v_month_start THEN
    UPDATE user_memory
       SET monthly_message_count = 1, monthly_window_start = v_month_start
     WHERE user_id = p_user_id;
    RETURN jsonb_build_object('allowed', true, 'monthly_count', 1, 'resets_at', (v_month_start + interval '1 month')::TEXT);
  END IF;

  -- At or over limit
  IF v_count >= p_limit THEN
    RETURN jsonb_build_object('allowed', false, 'monthly_count', v_count, 'resets_at', (v_month_start + interval '1 month')::TEXT);
  END IF;

  -- Increment
  UPDATE user_memory
     SET monthly_message_count = monthly_message_count + 1
   WHERE user_id = p_user_id;

  RETURN jsonb_build_object('allowed', true, 'monthly_count', v_count + 1, 'resets_at', (v_month_start + interval '1 month')::TEXT);
END;
$$;

REVOKE ALL ON FUNCTION check_and_increment_monthly_message(UUID, INT) FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION check_and_increment_monthly_message(UUID, INT) TO service_role;

-- ── Update overage function for new Pro limits ─────────────────
CREATE OR REPLACE FUNCTION increment_web_overage(p_user_id UUID)
RETURNS TABLE (new_overage_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan TEXT;
  v_limit INT;
  v_monthly_count INT;
  v_result INT;
BEGIN
  SELECT plan INTO v_plan
    FROM subscriptions
   WHERE user_id = p_user_id
     AND status IN ('active', 'trialing')
     AND overage_enabled = true;

  IF NOT FOUND THEN
    new_overage_count := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Pro = 200 msgs/month
  v_limit := CASE v_plan
    WHEN 'pro_monthly' THEN 200
    ELSE 10
  END;

  SELECT COALESCE(monthly_message_count, 0) INTO v_monthly_count
    FROM user_memory
   WHERE user_id = p_user_id;

  IF NOT FOUND OR v_monthly_count <= v_limit THEN
    new_overage_count := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE subscriptions
     SET overage_count = overage_count + 1,
         overage_rate_millicents = 100, -- $0.10 = 100 millicents
         updated_at = now()
   WHERE user_id = p_user_id
     AND status IN ('active', 'trialing')
     AND overage_enabled = true
  RETURNING overage_count INTO v_result;

  new_overage_count := COALESCE(v_result, 0);
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION increment_web_overage(UUID) FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION increment_web_overage(UUID) TO service_role;
