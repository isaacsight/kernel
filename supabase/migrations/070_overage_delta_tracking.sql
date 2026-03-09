-- 070: Fix overage billing — delta reporting instead of cumulative
--
-- Problem: task-scheduler sends cumulative overage_count to Stripe,
-- causing overbilling on every report cycle.
-- Fix: Track last_reported_overage_count to compute delta.

ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS last_reported_overage_count INT NOT NULL DEFAULT 0;

-- Reset on 30-day window — update validate_api_key to also reset last_reported_overage_count
DROP FUNCTION IF EXISTS validate_api_key(TEXT);
CREATE OR REPLACE FUNCTION validate_api_key(p_key_hash TEXT)
RETURNS TABLE (
  key_id                UUID,
  key_user_id           UUID,
  key_name              TEXT,
  key_tier              TEXT,
  monthly_message_limit INT,
  rate_limit_per_min    INT,
  swarm_enabled         BOOLEAN,
  all_agents_enabled    BOOLEAN,
  streaming_enabled     BOOLEAN,
  monthly_message_count INT,
  monthly_window_start  TIMESTAMPTZ,
  monthly_limit_exceeded BOOLEAN,
  monthly_token_budget  BIGINT,
  monthly_tokens_used   BIGINT,
  token_limit_exceeded  BOOLEAN,
  overage_enabled       BOOLEAN,
  overage_rate_millicents INT,
  overage_count         INT,
  max_monthly_spend_cents INT,
  spending_ceiling_hit  BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec api_keys%ROWTYPE;
  current_spend INT;
BEGIN
  SELECT * INTO rec
    FROM api_keys ak
   WHERE ak.key_hash = p_key_hash
     AND ak.status = 'active';

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Auto-reset 30-day window if expired
  IF rec.monthly_window_start + INTERVAL '30 days' < now() THEN
    UPDATE api_keys
       SET monthly_message_count = 0,
           monthly_tokens_used = 0,
           overage_count = 0,
           last_reported_overage_count = 0,
           alert_80_sent = false,
           alert_100_sent = false,
           last_overage_reported_at = NULL,
           monthly_window_start = now(),
           last_used_at = now()
     WHERE api_keys.id = rec.id;
    rec.monthly_message_count := 0;
    rec.monthly_tokens_used := 0;
    rec.overage_count := 0;
    rec.alert_80_sent := false;
    rec.alert_100_sent := false;
    rec.last_overage_reported_at := NULL;
    rec.monthly_window_start := now();
  ELSE
    UPDATE api_keys SET last_used_at = now() WHERE api_keys.id = rec.id;
  END IF;

  -- Calculate spending ceiling hit
  current_spend := rec.overage_count * rec.overage_rate_millicents;

  RETURN QUERY SELECT
    rec.id,
    rec.user_id,
    rec.name,
    rec.tier,
    rec.monthly_message_limit,
    rec.rate_limit_per_min,
    rec.swarm_enabled,
    rec.all_agents_enabled,
    rec.streaming_enabled,
    rec.monthly_message_count,
    rec.monthly_window_start,
    (rec.monthly_message_count >= rec.monthly_message_limit),
    rec.monthly_token_budget,
    rec.monthly_tokens_used,
    (rec.monthly_tokens_used >= rec.monthly_token_budget),
    rec.overage_enabled,
    rec.overage_rate_millicents,
    rec.overage_count,
    rec.max_monthly_spend_cents,
    (rec.max_monthly_spend_cents IS NOT NULL AND current_spend >= rec.max_monthly_spend_cents * 10);
END;
$$;

REVOKE ALL ON FUNCTION validate_api_key(TEXT) FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION validate_api_key(TEXT) TO service_role;
