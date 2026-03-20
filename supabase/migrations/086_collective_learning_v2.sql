-- 086: Collective Learning v2 — Fix schema for kbot collective signals
-- Resolves: type mismatches, missing columns, RPC parameter names, unique constraints

-- 1. Fix message_length: TEXT enum → INT (kbot sends character count)
ALTER TABLE routing_signals DROP CONSTRAINT IF EXISTS routing_signals_message_length_check;
ALTER TABLE routing_signals ALTER COLUMN message_length TYPE INT USING 0;

-- 2. Fix response_quality: TEXT enum → FLOAT (kbot sends 0-1 score)
ALTER TABLE routing_signals DROP CONSTRAINT IF EXISTS routing_signals_response_quality_check;
ALTER TABLE routing_signals ALTER COLUMN response_quality TYPE FLOAT USING 0.5;

-- 3. Add missing columns for tool_sequence and strategy
ALTER TABLE routing_signals ADD COLUMN IF NOT EXISTS tool_sequence TEXT[] DEFAULT '{}';
ALTER TABLE routing_signals ADD COLUMN IF NOT EXISTS strategy TEXT DEFAULT 'default';

-- 4. Add unique constraint on collective_knowledge for upsert
CREATE UNIQUE INDEX IF NOT EXISTS idx_collective_knowledge_unique
  ON collective_knowledge (pattern_type, (pattern->>'category'), (pattern->>'agent'));

-- 5. Replace log_routing_signal with corrected parameter names + new columns
DROP FUNCTION IF EXISTS log_routing_signal(TEXT, TEXT, TEXT, TEXT, FLOAT, TEXT);

CREATE OR REPLACE FUNCTION log_routing_signal(
  p_message_hash TEXT,
  p_message_category TEXT DEFAULT 'general',
  p_message_length INT DEFAULT 0,
  p_routed_agent TEXT DEFAULT 'kernel',
  p_classifier_confidence FLOAT DEFAULT 0.5,
  p_was_rerouted BOOLEAN DEFAULT false,
  p_response_quality FLOAT DEFAULT 0.5,
  p_tool_sequence TEXT[] DEFAULT '{}',
  p_strategy TEXT DEFAULT 'default',
  p_source TEXT DEFAULT 'kbot'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO routing_signals (
    message_hash, message_category, message_length, routed_agent,
    classifier_confidence, was_rerouted, response_quality,
    tool_sequence, strategy, source
  ) VALUES (
    p_message_hash, p_message_category, p_message_length, p_routed_agent,
    p_classifier_confidence, p_was_rerouted, p_response_quality,
    p_tool_sequence, p_strategy, p_source
  );
END;
$$;

REVOKE ALL ON FUNCTION log_routing_signal FROM PUBLIC;
REVOKE ALL ON FUNCTION log_routing_signal FROM authenticated;
REVOKE ALL ON FUNCTION log_routing_signal FROM anon;
GRANT EXECUTE ON FUNCTION log_routing_signal TO service_role;

-- 6. Update get_routing_hints to return agent-friendly shape
DROP FUNCTION IF EXISTS get_routing_hints(TEXT);

CREATE OR REPLACE FUNCTION get_routing_hints(p_category TEXT DEFAULT NULL)
RETURNS TABLE (
  category TEXT,
  best_agent TEXT,
  confidence FLOAT,
  sample_count INT,
  tool_sequence TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (ck.pattern->>'category')::TEXT AS category,
    (ck.pattern->>'agent')::TEXT AS best_agent,
    ck.confidence,
    ck.sample_count,
    ARRAY(SELECT jsonb_array_elements_text(
      CASE WHEN ck.pattern ? 'tools' THEN ck.pattern->'tools' ELSE '[]'::jsonb END
    ))::TEXT[] AS tool_sequence
  FROM collective_knowledge ck
  WHERE ck.sample_count > 10
    AND ck.confidence > 0.6
    AND ck.pattern_type IN ('routing_rule', 'tool_sequence')
    AND (p_category IS NULL OR ck.pattern->>'category' = p_category)
  ORDER BY ck.confidence DESC, ck.sample_count DESC
  LIMIT 50;
END;
$$;

REVOKE ALL ON FUNCTION get_routing_hints FROM PUBLIC;
REVOKE ALL ON FUNCTION get_routing_hints FROM authenticated;
REVOKE ALL ON FUNCTION get_routing_hints FROM anon;
GRANT EXECUTE ON FUNCTION get_routing_hints TO service_role;
