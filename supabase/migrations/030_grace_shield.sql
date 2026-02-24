-- Migration 030: Grace Shield — deferred charging, refund analytics, message state machine
-- Moves message charging to AFTER successful provider response.
-- Eliminates most refunds by never charging until success.

-- 1. Check message limit WITHOUT incrementing (read-only pre-flight)
CREATE OR REPLACE FUNCTION check_message_limit(p_user_id UUID)
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
  SELECT daily_message_count, daily_window_start INTO v_daily, v_window
  FROM user_memory WHERE user_id = p_user_id;

  -- No row yet = first message ever, allow it
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', true, 'daily_count', 0, 'resets_at', null);
  END IF;

  -- Window expired or null = new window, allow it
  IF v_window IS NULL OR v_now >= v_window + interval '24 hours' THEN
    RETURN jsonb_build_object('allowed', true, 'daily_count', 0, 'resets_at', null);
  END IF;

  -- Return current count and reset time (caller checks against their limit)
  RETURN jsonb_build_object(
    'allowed', true,
    'daily_count', v_daily,
    'resets_at', (v_window + interval '24 hours')::text
  );
END;
$$;

REVOKE ALL ON FUNCTION check_message_limit(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION check_message_limit(UUID) FROM authenticated;
REVOKE ALL ON FUNCTION check_message_limit(UUID) FROM anon;

-- 2. Refund pressure analytics — breakdowns by provider, model, hour, tier
CREATE OR REPLACE FUNCTION get_refund_analytics(p_hours INT DEFAULT 24)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since TIMESTAMPTZ := now() - (p_hours || ' hours')::INTERVAL;
  v_total_refunds INT;
  v_total_errors INT;
  v_by_provider JSONB;
  v_by_error_type JSONB;
  v_by_hour JSONB;
  v_avg_msg_cost NUMERIC;
  v_refund_cost NUMERIC;
BEGIN
  -- Total counts
  SELECT count(*) INTO v_total_errors FROM platform_errors WHERE created_at >= v_since;
  SELECT count(*) INTO v_total_refunds FROM platform_errors WHERE created_at >= v_since AND refunded = true;

  -- Refunds by provider
  SELECT COALESCE(jsonb_object_agg(provider, cnt), '{}'::jsonb) INTO v_by_provider
  FROM (
    SELECT provider, count(*) as cnt
    FROM platform_errors WHERE created_at >= v_since AND refunded = true
    GROUP BY provider
  ) sub;

  -- Refunds by error type
  SELECT COALESCE(jsonb_object_agg(error_type, cnt), '{}'::jsonb) INTO v_by_error_type
  FROM (
    SELECT error_type, count(*) as cnt
    FROM platform_errors WHERE created_at >= v_since AND refunded = true
    GROUP BY error_type
  ) sub;

  -- Refunds by hour of day (UTC)
  SELECT COALESCE(jsonb_object_agg(hr, cnt), '{}'::jsonb) INTO v_by_hour
  FROM (
    SELECT extract(hour from created_at)::int as hr, count(*) as cnt
    FROM platform_errors WHERE created_at >= v_since AND refunded = true
    GROUP BY hr ORDER BY hr
  ) sub;

  -- Average message cost (from usage_logs)
  SELECT COALESCE(avg(estimated_cost_usd), 0.03) INTO v_avg_msg_cost
  FROM usage_logs WHERE created_at >= v_since AND model != '__alert_sent__';

  v_refund_cost := v_total_refunds * v_avg_msg_cost;

  RETURN jsonb_build_object(
    'window_hours', p_hours,
    'total_errors', v_total_errors,
    'total_refunds', v_total_refunds,
    'refund_rate_pct', CASE WHEN v_total_errors > 0 THEN round((v_total_refunds * 100.0 / v_total_errors)::numeric, 1) ELSE 0 END,
    'refund_cost_usd', round(v_refund_cost::numeric, 4),
    'avg_message_cost_usd', round(v_avg_msg_cost::numeric, 6),
    'by_provider', v_by_provider,
    'by_error_type', v_by_error_type,
    'by_hour_utc', v_by_hour
  );
END;
$$;

REVOKE ALL ON FUNCTION get_refund_analytics(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_refund_analytics(INT) FROM authenticated;
REVOKE ALL ON FUNCTION get_refund_analytics(INT) FROM anon;

-- 3. Message state tracking — lightweight audit trail per API call
CREATE TABLE IF NOT EXISTS message_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  model TEXT,
  state TEXT NOT NULL DEFAULT 'pending',  -- pending, streaming, success, failed_platform, failed_user, refunded, retried
  attempt INT NOT NULL DEFAULT 1,
  retry_provider TEXT,                     -- fallback provider used (if retried)
  error_type TEXT,
  duration_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE message_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own message states"
  ON message_states FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_message_states_user ON message_states(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_states_recent ON message_states(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_states_state ON message_states(state, created_at DESC);

-- 4. Cleanup old message states (called by task-scheduler)
CREATE OR REPLACE FUNCTION cleanup_message_states(p_retention_days INT DEFAULT 30)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM message_states WHERE created_at < now() - (p_retention_days || ' days')::INTERVAL;
END;
$$;

REVOKE ALL ON FUNCTION cleanup_message_states(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION cleanup_message_states(INT) FROM authenticated;
REVOKE ALL ON FUNCTION cleanup_message_states(INT) FROM anon;
