-- Migration 031: Reliability dashboard RPCs
-- Comprehensive dashboard data for admins and user-facing error transparency.

-- 1. Full reliability dashboard (admin) — provider health, refund analytics, retry stats, trends
CREATE OR REPLACE FUNCTION get_reliability_dashboard()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_providers JSONB;
  v_trends JSONB;
  v_retry_stats JSONB;
  v_refund_analytics JSONB;
  v_recent_errors JSONB;
BEGIN
  -- Current provider scores (all windows)
  SELECT COALESCE(jsonb_object_agg(
    provider || '_' || time_window,
    jsonb_build_object(
      'provider', provider,
      'window', time_window,
      'score', score,
      'total_requests', total_requests,
      'success_count', success_count,
      'error_count', error_count,
      'timeout_count', timeout_count,
      'refund_count', refund_count,
      'computed_at', computed_at
    )
  ), '{}'::jsonb) INTO v_providers
  FROM provider_health;

  -- Trend detection: compare 15m vs 1h scores per provider
  SELECT COALESCE(jsonb_object_agg(p15.provider, jsonb_build_object(
    'score_15m', p15.score,
    'score_1h', p1h.score,
    'score_24h', p24h.score,
    'trend', CASE
      WHEN p15.score < p1h.score - 15 THEN 'declining'
      WHEN p15.score > p1h.score + 10 THEN 'recovering'
      ELSE 'stable'
    END,
    'delta_15m_1h', round((p15.score - p1h.score)::numeric, 1)
  )), '{}'::jsonb) INTO v_trends
  FROM provider_health p15
  JOIN provider_health p1h ON p15.provider = p1h.provider AND p1h.time_window = '1h'
  JOIN provider_health p24h ON p15.provider = p24h.provider AND p24h.time_window = '24h'
  WHERE p15.time_window = '15m';

  -- Retry success stats from message_states (last 24h)
  SELECT jsonb_build_object(
    'total_messages', count(*),
    'successful', count(*) FILTER (WHERE state = 'success'),
    'failed_platform', count(*) FILTER (WHERE state = 'failed_platform'),
    'retried', count(*) FILTER (WHERE attempt > 1),
    'retry_success', count(*) FILTER (WHERE attempt > 1 AND state = 'success'),
    'retry_saved_refunds', count(*) FILTER (WHERE attempt > 1 AND state = 'success'),
    'avg_duration_ms', round(avg(duration_ms)::numeric),
    'p95_duration_ms', round(percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms)::numeric)
  ) INTO v_retry_stats
  FROM message_states
  WHERE created_at >= now() - interval '24 hours';

  -- Refund analytics (delegate to existing RPC)
  SELECT get_refund_analytics(24) INTO v_refund_analytics;

  -- Last 10 platform errors
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'provider', provider,
    'model', model,
    'error_type', error_type,
    'http_status', http_status,
    'refunded', refunded,
    'created_at', created_at
  ) ORDER BY created_at DESC), '[]'::jsonb) INTO v_recent_errors
  FROM (
    SELECT * FROM platform_errors ORDER BY created_at DESC LIMIT 10
  ) sub;

  RETURN jsonb_build_object(
    'providers', v_providers,
    'trends', v_trends,
    'retry_stats', v_retry_stats,
    'refund_analytics', v_refund_analytics,
    'recent_errors', v_recent_errors,
    'generated_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION get_reliability_dashboard() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_reliability_dashboard() FROM authenticated;
REVOKE ALL ON FUNCTION get_reliability_dashboard() FROM anon;

-- 2. User-facing error/refund history — shows their own reliability data
CREATE OR REPLACE FUNCTION get_user_reliability(p_user_id UUID, p_days INT DEFAULT 7)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since TIMESTAMPTZ := now() - (p_days || ' days')::INTERVAL;
  v_errors JSONB;
  v_refund_count INT;
  v_total_messages INT;
  v_success_rate NUMERIC;
  v_message_history JSONB;
BEGIN
  -- Their recent platform errors
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'provider', provider,
    'error_type', error_type,
    'refunded', refunded,
    'created_at', created_at
  ) ORDER BY created_at DESC), '[]'::jsonb) INTO v_errors
  FROM (
    SELECT * FROM platform_errors
    WHERE user_id = p_user_id AND created_at >= v_since
    ORDER BY created_at DESC LIMIT 20
  ) sub;

  -- Refund count
  SELECT count(*) INTO v_refund_count
  FROM platform_errors
  WHERE user_id = p_user_id AND created_at >= v_since AND refunded = true;

  -- Message states summary
  SELECT count(*) INTO v_total_messages
  FROM message_states
  WHERE user_id = p_user_id AND created_at >= v_since;

  SELECT CASE WHEN v_total_messages > 0
    THEN round((count(*) FILTER (WHERE state = 'success') * 100.0 / v_total_messages)::numeric, 1)
    ELSE 100.0
  END INTO v_success_rate
  FROM message_states
  WHERE user_id = p_user_id AND created_at >= v_since;

  -- Daily breakdown for the period
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'date', d,
    'total', total,
    'success', success,
    'errors', errors
  ) ORDER BY d DESC), '[]'::jsonb) INTO v_message_history
  FROM (
    SELECT
      created_at::date AS d,
      count(*) AS total,
      count(*) FILTER (WHERE state = 'success') AS success,
      count(*) FILTER (WHERE state IN ('failed_platform', 'failed_user')) AS errors
    FROM message_states
    WHERE user_id = p_user_id AND created_at >= v_since
    GROUP BY d
  ) sub;

  RETURN jsonb_build_object(
    'period_days', p_days,
    'total_messages', v_total_messages,
    'success_rate_pct', v_success_rate,
    'refund_count', v_refund_count,
    'errors', v_errors,
    'daily_breakdown', v_message_history
  );
END;
$$;

REVOKE ALL ON FUNCTION get_user_reliability(UUID, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_user_reliability(UUID, INT) FROM authenticated;
REVOKE ALL ON FUNCTION get_user_reliability(UUID, INT) FROM anon;

-- 3. Enhanced provider scores — include trend data for predictive routing
CREATE OR REPLACE FUNCTION get_provider_scores_with_trends(p_window TEXT DEFAULT '15m')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT COALESCE(
    jsonb_object_agg(p_cur.provider, jsonb_build_object(
      'score', p_cur.score,
      'total', p_cur.total_requests,
      'errors', p_cur.error_count,
      'timeouts', p_cur.timeout_count,
      'refunds', p_cur.refund_count,
      'computed_at', p_cur.computed_at,
      'score_1h', p_1h.score,
      'trend', CASE
        WHEN p_cur.score < p_1h.score - 15 THEN 'declining'
        WHEN p_cur.score > p_1h.score + 10 THEN 'recovering'
        ELSE 'stable'
      END
    )),
    '{}'::jsonb
  ) INTO v_result
  FROM provider_health p_cur
  LEFT JOIN provider_health p_1h ON p_cur.provider = p_1h.provider AND p_1h.time_window = '1h'
  WHERE p_cur.time_window = p_window;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION get_provider_scores_with_trends(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_provider_scores_with_trends(TEXT) FROM authenticated;
REVOKE ALL ON FUNCTION get_provider_scores_with_trends(TEXT) FROM anon;
