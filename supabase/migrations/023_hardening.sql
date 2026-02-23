-- Migration 023: Hardening — durable rate limits, audit trail, cleanup RPCs, usage summary
-- Replaces in-memory rate limiting with Postgres-backed fixed-window counters.
-- Adds structured audit event log for compliance and Pro usage dashboard.

-- ============================================================================
-- 1. rate_limits — fixed-window counters
-- ============================================================================

CREATE TABLE IF NOT EXISTS rate_limits (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key          TEXT NOT NULL,
  endpoint     TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INT NOT NULL DEFAULT 1,
  UNIQUE (key, endpoint, window_start)
);

CREATE INDEX idx_rate_limits_lookup ON rate_limits (key, endpoint, window_start);
CREATE INDEX idx_rate_limits_cleanup ON rate_limits (window_start);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
-- No public policies — only service role can access

-- ============================================================================
-- 2. audit_events — structured event log
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_events (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id    UUID,
  actor_type  TEXT NOT NULL DEFAULT 'user',
  event_type  TEXT NOT NULL,
  action      TEXT NOT NULL,
  source      TEXT,
  status      TEXT NOT NULL DEFAULT 'success',
  status_code INT,
  metadata    JSONB DEFAULT '{}'::jsonb,
  ip_address  INET,
  user_agent  TEXT
);

CREATE INDEX idx_audit_actor   ON audit_events (actor_id, created_at DESC);
CREATE INDEX idx_audit_event   ON audit_events (event_type, created_at DESC);
CREATE INDEX idx_audit_source  ON audit_events (source, created_at DESC);
CREATE INDEX idx_audit_errors  ON audit_events (status, created_at DESC) WHERE status != 'success';

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
-- No public policies — only service role can access

-- ============================================================================
-- 3. check_rate_limit RPC — atomic fixed-window counter
-- ============================================================================

CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key          TEXT,
  p_endpoint     TEXT,
  p_limit        INT,
  p_window_seconds INT DEFAULT 60
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count        INT;
  v_allowed      BOOLEAN;
  v_retry_after  INT;
BEGIN
  -- Calculate the start of the current fixed window
  v_window_start := date_trunc('second', now())
    - (EXTRACT(EPOCH FROM now())::INT % p_window_seconds) * INTERVAL '1 second';

  -- Atomic upsert: insert or increment
  INSERT INTO rate_limits (key, endpoint, window_start, request_count)
  VALUES (p_key, p_endpoint, v_window_start, 1)
  ON CONFLICT (key, endpoint, window_start)
  DO UPDATE SET request_count = rate_limits.request_count + 1
  RETURNING request_count INTO v_count;

  IF v_count > p_limit THEN
    -- Over limit — roll back the increment
    UPDATE rate_limits
    SET request_count = request_count - 1
    WHERE key = p_key AND endpoint = p_endpoint AND window_start = v_window_start;

    v_allowed := FALSE;
    v_retry_after := p_window_seconds - EXTRACT(EPOCH FROM (now() - v_window_start))::INT;
    IF v_retry_after < 1 THEN v_retry_after := 1; END IF;
  ELSE
    v_allowed := TRUE;
    v_retry_after := 0;
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'current_count', LEAST(v_count, p_limit + 1),
    'limit', p_limit,
    'retry_after_seconds', v_retry_after
  );
END;
$$;

REVOKE ALL ON FUNCTION check_rate_limit(TEXT, TEXT, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION check_rate_limit(TEXT, TEXT, INT, INT) FROM authenticated;
REVOKE ALL ON FUNCTION check_rate_limit(TEXT, TEXT, INT, INT) FROM anon;

-- ============================================================================
-- 4. log_audit_event RPC — fire-and-forget event logging
-- ============================================================================

CREATE OR REPLACE FUNCTION log_audit_event(
  p_actor_id    UUID DEFAULT NULL,
  p_actor_type  TEXT DEFAULT 'user',
  p_event_type  TEXT DEFAULT 'edge_function.call',
  p_action      TEXT DEFAULT '',
  p_source      TEXT DEFAULT NULL,
  p_status      TEXT DEFAULT 'success',
  p_status_code INT DEFAULT NULL,
  p_metadata    JSONB DEFAULT '{}'::jsonb,
  p_ip_address  INET DEFAULT NULL,
  p_user_agent  TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_events (
    actor_id, actor_type, event_type, action, source,
    status, status_code, metadata, ip_address, user_agent
  ) VALUES (
    p_actor_id, p_actor_type, p_event_type, p_action, p_source,
    p_status, p_status_code, p_metadata, p_ip_address, p_user_agent
  );
EXCEPTION WHEN OTHERS THEN
  -- Never break the caller — swallow all errors
  RAISE WARNING 'log_audit_event failed: %', SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION log_audit_event(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INT, JSONB, INET, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION log_audit_event(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INT, JSONB, INET, TEXT) FROM authenticated;
REVOKE ALL ON FUNCTION log_audit_event(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INT, JSONB, INET, TEXT) FROM anon;

-- ============================================================================
-- 5. cleanup_rate_limits — purge expired windows
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM rate_limits WHERE window_start < now() - INTERVAL '5 minutes';
END;
$$;

REVOKE ALL ON FUNCTION cleanup_rate_limits() FROM PUBLIC;
REVOKE ALL ON FUNCTION cleanup_rate_limits() FROM authenticated;
REVOKE ALL ON FUNCTION cleanup_rate_limits() FROM anon;

-- ============================================================================
-- 6. cleanup_audit_events — purge old events
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_audit_events(p_retention_days INT DEFAULT 90)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM audit_events WHERE created_at < now() - (p_retention_days || ' days')::INTERVAL;
END;
$$;

REVOKE ALL ON FUNCTION cleanup_audit_events(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION cleanup_audit_events(INT) FROM authenticated;
REVOKE ALL ON FUNCTION cleanup_audit_events(INT) FROM anon;

-- ============================================================================
-- 7. get_usage_summary — aggregated usage for Pro dashboard
-- ============================================================================

CREATE OR REPLACE FUNCTION get_usage_summary(p_user_id UUID, p_days INT DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start     TIMESTAMPTZ;
  v_total_req BIGINT;
  v_tokens    JSONB;
  v_cost      NUMERIC;
  v_agents    JSONB;
  v_endpoints JSONB;
  v_daily     JSONB;
  v_recent    JSONB;
BEGIN
  v_start := now() - (p_days || ' days')::INTERVAL;

  -- Total requests from audit_events
  SELECT COUNT(*) INTO v_total_req
  FROM audit_events
  WHERE actor_id = p_user_id AND created_at >= v_start;

  -- Token totals from usage_logs (direct columns)
  SELECT COALESCE(jsonb_build_object(
    'input', SUM(input_tokens),
    'output', SUM(output_tokens)
  ), '{"input":0,"output":0}'::jsonb)
  INTO v_tokens
  FROM usage_logs
  WHERE user_id = p_user_id AND created_at >= v_start;

  -- Estimated cost from usage_logs
  SELECT COALESCE(SUM(estimated_cost_usd), 0) INTO v_cost
  FROM usage_logs
  WHERE user_id = p_user_id AND created_at >= v_start;

  -- Top agents (from audit metadata)
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_agents
  FROM (
    SELECT metadata->>'agent' AS "agentId", COUNT(*) AS count
    FROM audit_events
    WHERE actor_id = p_user_id AND created_at >= v_start
      AND metadata->>'agent' IS NOT NULL
    GROUP BY metadata->>'agent'
    ORDER BY count DESC
    LIMIT 10
  ) t;

  -- Top endpoints
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_endpoints
  FROM (
    SELECT source AS endpoint, COUNT(*) AS count
    FROM audit_events
    WHERE actor_id = p_user_id AND created_at >= v_start
      AND source IS NOT NULL
    GROUP BY source
    ORDER BY count DESC
    LIMIT 10
  ) t;

  -- Daily usage (requests + tokens)
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.date), '[]'::jsonb) INTO v_daily
  FROM (
    SELECT
      ae.date,
      ae.requests,
      COALESCE(ul.tokens, 0) AS tokens
    FROM (
      SELECT created_at::date AS date, COUNT(*) AS requests
      FROM audit_events
      WHERE actor_id = p_user_id AND created_at >= v_start
      GROUP BY created_at::date
    ) ae
    LEFT JOIN LATERAL (
      SELECT SUM(input_tokens + output_tokens) AS tokens
      FROM usage_logs
      WHERE user_id = p_user_id AND created_at::date = ae.date
    ) ul ON TRUE
  ) t;

  -- Recent activity (last 50 events)
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_recent
  FROM (
    SELECT action, source, created_at AS timestamp, metadata
    FROM audit_events
    WHERE actor_id = p_user_id AND created_at >= v_start
    ORDER BY created_at DESC
    LIMIT 50
  ) t;

  RETURN jsonb_build_object(
    'period', jsonb_build_object('start', v_start, 'end', now()),
    'summary', jsonb_build_object(
      'totalRequests', v_total_req,
      'totalTokens', v_tokens,
      'estimatedCost', v_cost,
      'topAgents', v_agents,
      'topEndpoints', v_endpoints,
      'dailyUsage', v_daily
    ),
    'recentActivity', v_recent
  );
END;
$$;

REVOKE ALL ON FUNCTION get_usage_summary(UUID, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_usage_summary(UUID, INT) FROM authenticated;
REVOKE ALL ON FUNCTION get_usage_summary(UUID, INT) FROM anon;
