-- Migration 028: Platform reliability — error tracking, auto-refunds, health monitoring
-- When platform errors occur (upstream API failures, timeouts), automatically
-- refund the user's daily message count so they aren't penalized for our failures.

-- 1. Platform errors table — records every platform-side failure
CREATE TABLE IF NOT EXISTS platform_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  model TEXT,
  error_type TEXT NOT NULL,          -- 'upstream_5xx', 'timeout', 'missing_key', 'internal'
  error_message TEXT,
  http_status INT,
  refunded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE platform_errors ENABLE ROW LEVEL SECURITY;

-- Users can read their own errors (for transparency)
CREATE POLICY "Users can view their own errors"
  ON platform_errors FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_platform_errors_user ON platform_errors(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_errors_recent ON platform_errors(created_at DESC);

-- 2. Refund message RPC — decrements daily_message_count by 1 (floor at 0)
CREATE OR REPLACE FUNCTION refund_message(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_daily INT;
  v_window TIMESTAMPTZ;
BEGIN
  PERFORM set_config('app.allow_message_count_update', 'true', true);

  UPDATE user_memory SET
    message_count = GREATEST(message_count - 1, 0),
    daily_message_count = GREATEST(daily_message_count - 1, 0)
  WHERE user_id = p_user_id
  RETURNING daily_message_count, daily_window_start INTO v_daily, v_window;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('refunded', false, 'reason', 'no_user_memory');
  END IF;

  RETURN jsonb_build_object(
    'refunded', true,
    'daily_count', v_daily,
    'resets_at', CASE WHEN v_window IS NOT NULL THEN (v_window + interval '24 hours')::text ELSE null END
  );
END;
$$;

REVOKE ALL ON FUNCTION refund_message(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION refund_message(UUID) FROM authenticated;
REVOKE ALL ON FUNCTION refund_message(UUID) FROM anon;

-- 3. Health check RPC — returns error stats for a given time window
CREATE OR REPLACE FUNCTION get_error_health(p_window_minutes INT DEFAULT 15)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since TIMESTAMPTZ := now() - (p_window_minutes || ' minutes')::INTERVAL;
  v_total INT;
  v_platform INT;
  v_refunded INT;
  v_by_provider JSONB;
  v_by_type JSONB;
BEGIN
  SELECT count(*) INTO v_total
  FROM platform_errors WHERE created_at >= v_since;

  SELECT count(*) INTO v_platform
  FROM platform_errors WHERE created_at >= v_since
    AND error_type IN ('upstream_5xx', 'timeout', 'missing_key', 'internal');

  SELECT count(*) INTO v_refunded
  FROM platform_errors WHERE created_at >= v_since AND refunded = true;

  SELECT COALESCE(jsonb_object_agg(provider, cnt), '{}'::jsonb) INTO v_by_provider
  FROM (
    SELECT provider, count(*) as cnt
    FROM platform_errors WHERE created_at >= v_since
    GROUP BY provider
  ) sub;

  SELECT COALESCE(jsonb_object_agg(error_type, cnt), '{}'::jsonb) INTO v_by_type
  FROM (
    SELECT error_type, count(*) as cnt
    FROM platform_errors WHERE created_at >= v_since
    GROUP BY error_type
  ) sub;

  RETURN jsonb_build_object(
    'window_minutes', p_window_minutes,
    'total_errors', v_total,
    'platform_errors', v_platform,
    'refunded_count', v_refunded,
    'platform_error_rate_pct', CASE WHEN v_total > 0 THEN round((v_platform * 100.0 / v_total)::numeric, 1) ELSE 0 END,
    'by_provider', v_by_provider,
    'by_type', v_by_type
  );
END;
$$;

REVOKE ALL ON FUNCTION get_error_health(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_error_health(INT) FROM authenticated;
REVOKE ALL ON FUNCTION get_error_health(INT) FROM anon;

-- 4. Cleanup RPC for old errors (called by task-scheduler)
CREATE OR REPLACE FUNCTION cleanup_platform_errors(p_retention_days INT DEFAULT 30)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM platform_errors WHERE created_at < now() - (p_retention_days || ' days')::INTERVAL;
END;
$$;

REVOKE ALL ON FUNCTION cleanup_platform_errors(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION cleanup_platform_errors(INT) FROM authenticated;
REVOKE ALL ON FUNCTION cleanup_platform_errors(INT) FROM anon;

-- 5. Expand notifications type CHECK to include 'refund'
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('info', 'reminder', 'task_complete', 'briefing', 'goal', 'refund'));
