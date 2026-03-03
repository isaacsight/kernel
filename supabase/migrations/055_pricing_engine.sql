-- ═══════════════════════════════════════════════════════════════
--  055 — Pricing Engine: Cost Attribution & Usage Forecasting
-- ═══════════════════════════════════════════════════════════════

-- 1. Add feature tag + conversation_id to usage_logs
ALTER TABLE usage_logs ADD COLUMN IF NOT EXISTS feature TEXT DEFAULT 'chat';
ALTER TABLE usage_logs ADD COLUMN IF NOT EXISTS conversation_id UUID;

-- 2. Indexes for cost attribution queries
CREATE INDEX IF NOT EXISTS idx_usage_logs_feature_cost
  ON usage_logs (user_id, feature, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usage_logs_cost_agg
  ON usage_logs (created_at DESC, feature)
  WHERE model != '__alert_sent__';

-- 3. RPC: get_user_cost_summary — daily cost by feature for a user
CREATE OR REPLACE FUNCTION get_user_cost_summary(
  p_user_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'user_id', p_user_id,
    'days', p_days,
    'total_cost', COALESCE(SUM(estimated_cost_usd), 0),
    'total_input_tokens', COALESCE(SUM(input_tokens), 0),
    'total_output_tokens', COALESCE(SUM(output_tokens), 0),
    'total_requests', COUNT(*),
    'by_feature', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'feature', f.feature,
          'cost', f.cost,
          'requests', f.cnt,
          'input_tokens', f.inp,
          'output_tokens', f.outp
        )
      ), '[]'::jsonb)
      FROM (
        SELECT feature,
               COALESCE(SUM(estimated_cost_usd), 0) AS cost,
               COUNT(*) AS cnt,
               COALESCE(SUM(input_tokens), 0) AS inp,
               COALESCE(SUM(output_tokens), 0) AS outp
        FROM usage_logs
        WHERE user_id = p_user_id
          AND model != '__alert_sent__'
          AND created_at >= NOW() - (p_days || ' days')::INTERVAL
        GROUP BY feature
        ORDER BY cost DESC
      ) f
    ),
    'daily_trend', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'date', d.day::TEXT,
          'cost', d.cost,
          'requests', d.cnt
        )
        ORDER BY d.day
      ), '[]'::jsonb)
      FROM (
        SELECT DATE(created_at) AS day,
               COALESCE(SUM(estimated_cost_usd), 0) AS cost,
               COUNT(*) AS cnt
        FROM usage_logs
        WHERE user_id = p_user_id
          AND model != '__alert_sent__'
          AND created_at >= NOW() - (p_days || ' days')::INTERVAL
        GROUP BY DATE(created_at)
        ORDER BY day
      ) d
    )
  ) INTO result
  FROM usage_logs
  WHERE user_id = p_user_id
    AND model != '__alert_sent__'
    AND created_at >= NOW() - (p_days || ' days')::INTERVAL;

  RETURN result;
END;
$$;

-- 4. RPC: get_platform_cost_analytics — admin overview
CREATE OR REPLACE FUNCTION get_platform_cost_analytics(
  p_days INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'days', p_days,
    'total_cost', COALESCE(SUM(estimated_cost_usd), 0),
    'total_requests', COUNT(*),
    'total_input_tokens', COALESCE(SUM(input_tokens), 0),
    'total_output_tokens', COALESCE(SUM(output_tokens), 0),
    'unique_users', COUNT(DISTINCT user_id),
    'by_feature', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'feature', f.feature,
          'cost', f.cost,
          'requests', f.cnt,
          'pct', CASE WHEN SUM(f.cost) OVER () > 0
                      THEN ROUND((f.cost / SUM(f.cost) OVER ()) * 100, 1)
                      ELSE 0 END
        )
      ), '[]'::jsonb)
      FROM (
        SELECT feature,
               COALESCE(SUM(estimated_cost_usd), 0) AS cost,
               COUNT(*) AS cnt
        FROM usage_logs
        WHERE model != '__alert_sent__'
          AND created_at >= NOW() - (p_days || ' days')::INTERVAL
        GROUP BY feature
        ORDER BY cost DESC
      ) f
    ),
    'by_model', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'model', m.model,
          'cost', m.cost,
          'requests', m.cnt
        )
      ), '[]'::jsonb)
      FROM (
        SELECT model,
               COALESCE(SUM(estimated_cost_usd), 0) AS cost,
               COUNT(*) AS cnt
        FROM usage_logs
        WHERE model != '__alert_sent__'
          AND created_at >= NOW() - (p_days || ' days')::INTERVAL
        GROUP BY model
        ORDER BY cost DESC
      ) m
    ),
    'top_users', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'user_id', u.user_id,
          'cost', u.cost,
          'requests', u.cnt
        )
      ), '[]'::jsonb)
      FROM (
        SELECT user_id,
               COALESCE(SUM(estimated_cost_usd), 0) AS cost,
               COUNT(*) AS cnt
        FROM usage_logs
        WHERE model != '__alert_sent__'
          AND created_at >= NOW() - (p_days || ' days')::INTERVAL
        GROUP BY user_id
        ORDER BY cost DESC
        LIMIT 20
      ) u
    ),
    'daily_trend', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'date', d.day::TEXT,
          'cost', d.cost,
          'requests', d.cnt,
          'users', d.users
        )
        ORDER BY d.day
      ), '[]'::jsonb)
      FROM (
        SELECT DATE(created_at) AS day,
               COALESCE(SUM(estimated_cost_usd), 0) AS cost,
               COUNT(*) AS cnt,
               COUNT(DISTINCT user_id) AS users
        FROM usage_logs
        WHERE model != '__alert_sent__'
          AND created_at >= NOW() - (p_days || ' days')::INTERVAL
        GROUP BY DATE(created_at)
        ORDER BY day
      ) d
    )
  ) INTO result
  FROM usage_logs
  WHERE model != '__alert_sent__'
    AND created_at >= NOW() - (p_days || ' days')::INTERVAL;

  RETURN result;
END;
$$;

-- 5. RPC: get_usage_forecast — projected usage for a user
CREATE OR REPLACE FUNCTION get_usage_forecast(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  v_daily_avg NUMERIC;
  v_days_in_period INTEGER := 30;
  v_days_used INTEGER;
  v_total_requests BIGINT;
  v_total_cost NUMERIC;
BEGIN
  -- Calculate daily average over last 30 days
  SELECT COUNT(DISTINCT DATE(created_at)),
         COUNT(*),
         COALESCE(SUM(estimated_cost_usd), 0)
  INTO v_days_used, v_total_requests, v_total_cost
  FROM usage_logs
  WHERE user_id = p_user_id
    AND model != '__alert_sent__'
    AND created_at >= NOW() - INTERVAL '30 days';

  v_daily_avg := CASE WHEN v_days_used > 0
                      THEN v_total_requests::NUMERIC / v_days_used
                      ELSE 0 END;

  SELECT jsonb_build_object(
    'user_id', p_user_id,
    'period_days', v_days_in_period,
    'active_days', v_days_used,
    'total_requests', v_total_requests,
    'total_cost', v_total_cost,
    'daily_avg_requests', ROUND(v_daily_avg, 1),
    'projected_monthly_requests', ROUND(v_daily_avg * 30, 0),
    'projected_monthly_cost', ROUND((v_total_cost / GREATEST(v_days_used, 1)) * 30, 4),
    'by_feature', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'feature', f.feature,
          'requests', f.cnt,
          'cost', f.cost,
          'daily_avg', ROUND(f.cnt::NUMERIC / GREATEST(v_days_used, 1), 1)
        )
      ), '[]'::jsonb)
      FROM (
        SELECT feature,
               COUNT(*) AS cnt,
               COALESCE(SUM(estimated_cost_usd), 0) AS cost
        FROM usage_logs
        WHERE user_id = p_user_id
          AND model != '__alert_sent__'
          AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY feature
        ORDER BY cnt DESC
      ) f
    ),
    'weekly_trend', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'week', w.week_start::TEXT,
          'requests', w.cnt,
          'cost', w.cost
        )
        ORDER BY w.week_start
      ), '[]'::jsonb)
      FROM (
        SELECT DATE_TRUNC('week', created_at)::DATE AS week_start,
               COUNT(*) AS cnt,
               COALESCE(SUM(estimated_cost_usd), 0) AS cost
        FROM usage_logs
        WHERE user_id = p_user_id
          AND model != '__alert_sent__'
          AND created_at >= NOW() - INTERVAL '90 days'
        GROUP BY DATE_TRUNC('week', created_at)
        ORDER BY week_start
      ) w
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Revoke public access — these are called via service role in edge functions
REVOKE ALL ON FUNCTION get_user_cost_summary FROM public, authenticated, anon;
REVOKE ALL ON FUNCTION get_platform_cost_analytics FROM public, authenticated, anon;
REVOKE ALL ON FUNCTION get_usage_forecast FROM public, authenticated, anon;
