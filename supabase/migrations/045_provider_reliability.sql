-- Migration 029: Provider reliability scoring & smart retry support
-- Computes rolling health scores per provider from usage_logs (success)
-- and platform_errors (failure). Scores drive routing and retry decisions.

-- 1. Provider health snapshots — updated by task-scheduler every 5 min
CREATE TABLE IF NOT EXISTS provider_health (
  provider TEXT NOT NULL,
  time_window TEXT NOT NULL,           -- '15m', '1h', '24h'
  score NUMERIC(5,1) NOT NULL DEFAULT 100.0,
  total_requests INT NOT NULL DEFAULT 0,
  success_count INT NOT NULL DEFAULT 0,
  error_count INT NOT NULL DEFAULT 0,
  timeout_count INT NOT NULL DEFAULT 0,
  avg_latency_ms INT,
  refund_count INT NOT NULL DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, time_window)
);

ALTER TABLE provider_health ENABLE ROW LEVEL SECURITY;

-- Public read — anyone can see provider health (transparency)
CREATE POLICY "Provider health is public" ON provider_health FOR SELECT USING (true);

-- 2. Compute provider health scores from usage_logs + platform_errors
CREATE OR REPLACE FUNCTION compute_provider_health()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window RECORD;
  v_provider TEXT;
  v_providers TEXT[] := ARRAY['anthropic', 'openai', 'gemini', 'nvidia'];
  v_since TIMESTAMPTZ;
  v_successes INT;
  v_errors INT;
  v_timeouts INT;
  v_refunds INT;
  v_total INT;
  v_score NUMERIC(5,1);
BEGIN
  -- Process each time window
  FOR v_window IN
    SELECT '15m' AS name, interval '15 minutes' AS dur
    UNION ALL SELECT '1h', interval '1 hour'
    UNION ALL SELECT '24h', interval '24 hours'
  LOOP
    v_since := now() - v_window.dur;

    FOREACH v_provider IN ARRAY v_providers LOOP
      -- Count successes from usage_logs (excludes system markers)
      SELECT count(*) INTO v_successes
      FROM usage_logs
      WHERE provider = v_provider
        AND created_at >= v_since
        AND model != '__alert_sent__';

      -- Count errors from platform_errors
      SELECT count(*) INTO v_errors
      FROM platform_errors
      WHERE provider = v_provider
        AND created_at >= v_since;

      -- Count timeouts specifically
      SELECT count(*) INTO v_timeouts
      FROM platform_errors
      WHERE provider = v_provider
        AND created_at >= v_since
        AND error_type = 'timeout';

      -- Count refunds
      SELECT count(*) INTO v_refunds
      FROM platform_errors
      WHERE provider = v_provider
        AND created_at >= v_since
        AND refunded = true;

      v_total := v_successes + v_errors;

      -- Score formula: 100 - (error_rate * 50) - (timeout_rate * 30) - (refund_rate * 20)
      -- Each rate is percentage of total. Min score 0.
      IF v_total > 0 THEN
        v_score := GREATEST(0,
          100.0
          - (v_errors::numeric / v_total * 50)
          - (v_timeouts::numeric / v_total * 30)
          - (v_refunds::numeric / v_total * 20)
        );
      ELSE
        -- No data = assume healthy (benefit of the doubt)
        v_score := 100.0;
      END IF;

      -- Upsert
      INSERT INTO provider_health (provider, time_window, score, total_requests, success_count, error_count, timeout_count, refund_count, computed_at)
      VALUES (v_provider, v_window.name, v_score, v_total, v_successes, v_errors, v_timeouts, v_refunds, now())
      ON CONFLICT (provider, time_window) DO UPDATE SET
        score = EXCLUDED.score,
        total_requests = EXCLUDED.total_requests,
        success_count = EXCLUDED.success_count,
        error_count = EXCLUDED.error_count,
        timeout_count = EXCLUDED.timeout_count,
        refund_count = EXCLUDED.refund_count,
        computed_at = EXCLUDED.computed_at;
    END LOOP;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION compute_provider_health() FROM PUBLIC;
REVOKE ALL ON FUNCTION compute_provider_health() FROM authenticated;
REVOKE ALL ON FUNCTION compute_provider_health() FROM anon;

-- 3. Fast lookup: get all provider scores for a given window (called by claude-proxy)
CREATE OR REPLACE FUNCTION get_provider_scores(p_window TEXT DEFAULT '15m')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT COALESCE(
    jsonb_object_agg(provider, jsonb_build_object(
      'score', score,
      'total', total_requests,
      'errors', error_count,
      'timeouts', timeout_count,
      'refunds', refund_count,
      'computed_at', computed_at
    )),
    '{}'::jsonb
  ) INTO v_result
  FROM provider_health
  WHERE time_window = p_window;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION get_provider_scores(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_provider_scores(TEXT) FROM authenticated;
REVOKE ALL ON FUNCTION get_provider_scores(TEXT) FROM anon;

-- 4. Seed initial rows so first reads don't return empty
INSERT INTO provider_health (provider, time_window, score) VALUES
  ('anthropic', '15m', 100), ('anthropic', '1h', 100), ('anthropic', '24h', 100),
  ('openai', '15m', 100), ('openai', '1h', 100), ('openai', '24h', 100),
  ('gemini', '15m', 100), ('gemini', '1h', 100), ('gemini', '24h', 100),
  ('nvidia', '15m', 100), ('nvidia', '1h', 100), ('nvidia', '24h', 100)
ON CONFLICT DO NOTHING;
