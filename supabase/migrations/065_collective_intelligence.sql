-- 065: Collective Intelligence — routing signals + learned patterns
-- The foundation for the Kernel Matrix getting smarter from every interaction

-- Table: routing_signals — anonymized routing feedback from API/K:BOT/web
CREATE TABLE IF NOT EXISTS routing_signals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_hash      TEXT NOT NULL,
  message_category  TEXT,
  message_length    TEXT NOT NULL CHECK (message_length IN ('short', 'medium', 'long')),
  routed_agent      TEXT NOT NULL,
  classifier_confidence FLOAT,
  was_rerouted      BOOLEAN DEFAULT false,
  response_quality  TEXT CHECK (response_quality IN ('good', 'bad', 'neutral')),
  source            TEXT DEFAULT 'api' CHECK (source IN ('api', 'kbot', 'web')),
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Indexes for aggregation queries
CREATE INDEX idx_routing_signals_category ON routing_signals (message_category, created_at DESC);
CREATE INDEX idx_routing_signals_agent ON routing_signals (routed_agent, created_at DESC);
CREATE INDEX idx_routing_signals_created ON routing_signals (created_at DESC);

-- Table: collective_knowledge — shared patterns learned across all users
CREATE TABLE IF NOT EXISTS collective_knowledge (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type      TEXT NOT NULL CHECK (pattern_type IN ('routing_rule', 'prompt_technique', 'tool_sequence')),
  pattern           JSONB NOT NULL,
  confidence        FLOAT DEFAULT 0.5,
  sample_count      INT DEFAULT 1,
  last_updated      TIMESTAMPTZ DEFAULT now(),
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_collective_knowledge_type ON collective_knowledge (pattern_type, confidence DESC);
CREATE INDEX idx_collective_knowledge_confidence ON collective_knowledge (confidence DESC) WHERE sample_count > 50;

-- RLS: No public access. Service role only.
ALTER TABLE routing_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE collective_knowledge ENABLE ROW LEVEL SECURITY;

-- No RLS policies = only service_role can access

-- RPC: log_routing_signal — called after every agent-routed response
CREATE OR REPLACE FUNCTION log_routing_signal(
  p_message_hash TEXT,
  p_category TEXT,
  p_length TEXT,
  p_agent TEXT,
  p_confidence FLOAT DEFAULT 1.0,
  p_source TEXT DEFAULT 'api'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO routing_signals (message_hash, message_category, message_length, routed_agent, classifier_confidence, source)
  VALUES (p_message_hash, p_category, p_length, p_agent, p_confidence, p_source);
END;
$$;

-- Revoke from public, grant to service_role only
REVOKE ALL ON FUNCTION log_routing_signal FROM PUBLIC;
REVOKE ALL ON FUNCTION log_routing_signal FROM authenticated;
REVOKE ALL ON FUNCTION log_routing_signal FROM anon;
GRANT EXECUTE ON FUNCTION log_routing_signal TO service_role;

-- RPC: get_routing_hints — returns learned patterns for a message category
CREATE OR REPLACE FUNCTION get_routing_hints(p_category TEXT DEFAULT NULL)
RETURNS TABLE (
  pattern_type TEXT,
  pattern JSONB,
  confidence FLOAT,
  sample_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT ck.pattern_type, ck.pattern, ck.confidence, ck.sample_count
  FROM collective_knowledge ck
  WHERE ck.sample_count > 50
    AND ck.confidence > 0.7
    AND (p_category IS NULL OR ck.pattern->>'category' = p_category)
  ORDER BY ck.confidence DESC, ck.sample_count DESC
  LIMIT 20;
END;
$$;

REVOKE ALL ON FUNCTION get_routing_hints FROM PUBLIC;
REVOKE ALL ON FUNCTION get_routing_hints FROM authenticated;
REVOKE ALL ON FUNCTION get_routing_hints FROM anon;
GRANT EXECUTE ON FUNCTION get_routing_hints TO service_role;

-- RPC: aggregate_routing_signals — used by collective-learn to compute patterns
CREATE OR REPLACE FUNCTION aggregate_routing_signals(p_window_hours INT DEFAULT 6)
RETURNS TABLE (
  category TEXT,
  agent TEXT,
  total_count BIGINT,
  reroute_count BIGINT,
  avg_confidence FLOAT,
  accuracy FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rs.message_category AS category,
    rs.routed_agent AS agent,
    COUNT(*) AS total_count,
    COUNT(*) FILTER (WHERE rs.was_rerouted) AS reroute_count,
    AVG(rs.classifier_confidence)::FLOAT AS avg_confidence,
    (1.0 - (COUNT(*) FILTER (WHERE rs.was_rerouted))::FLOAT / GREATEST(COUNT(*), 1))::FLOAT AS accuracy
  FROM routing_signals rs
  WHERE rs.created_at > now() - (p_window_hours || ' hours')::INTERVAL
  GROUP BY rs.message_category, rs.routed_agent
  HAVING COUNT(*) >= 5
  ORDER BY COUNT(*) DESC;
END;
$$;

REVOKE ALL ON FUNCTION aggregate_routing_signals FROM PUBLIC;
REVOKE ALL ON FUNCTION aggregate_routing_signals FROM authenticated;
REVOKE ALL ON FUNCTION aggregate_routing_signals FROM anon;
GRANT EXECUTE ON FUNCTION aggregate_routing_signals TO service_role;

-- Cleanup: auto-purge signals older than 30 days (called by task-scheduler)
CREATE OR REPLACE FUNCTION purge_old_routing_signals()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM routing_signals WHERE created_at < now() - INTERVAL '30 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION purge_old_routing_signals FROM PUBLIC;
REVOKE ALL ON FUNCTION purge_old_routing_signals FROM authenticated;
REVOKE ALL ON FUNCTION purge_old_routing_signals FROM anon;
GRANT EXECUTE ON FUNCTION purge_old_routing_signals TO service_role;
