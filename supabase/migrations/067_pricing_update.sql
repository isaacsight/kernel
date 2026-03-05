-- 067: Pricing update — sustainable margins
--
-- New pricing matrix:
--   Free:       $0/mo,     50 msgs,   100K token cap,  10/min
--   Pro:        $39/mo,    1,500 msgs, 3M token cap,   30/min
--   Growth:     $249/mo,   10,000 msgs, 25M token cap, 120/min
--   Enterprise: Custom,    unlimited,  unlimited,       180/min

-- Add token_budget column for hidden safety net
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS monthly_token_budget BIGINT NOT NULL DEFAULT 100000;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS monthly_tokens_used BIGINT NOT NULL DEFAULT 0;

-- Update limits per tier
UPDATE api_keys
   SET monthly_message_limit = 50,
       rate_limit_per_min = 10,
       monthly_token_budget = 100000,
       streaming_enabled = false
 WHERE tier = 'free';

UPDATE api_keys
   SET monthly_message_limit = 1500,
       rate_limit_per_min = 30,
       monthly_token_budget = 3000000,
       streaming_enabled = true
 WHERE tier = 'pro';

UPDATE api_keys
   SET monthly_message_limit = 10000,
       rate_limit_per_min = 120,
       monthly_token_budget = 25000000,
       swarm_enabled = true,
       all_agents_enabled = true,
       streaming_enabled = true
 WHERE tier = 'growth';

UPDATE api_keys
   SET monthly_message_limit = 999999,
       rate_limit_per_min = 180,
       monthly_token_budget = 999999999,
       swarm_enabled = true,
       all_agents_enabled = true,
       streaming_enabled = true
 WHERE tier = 'enterprise';

-- Update defaults for new keys
ALTER TABLE api_keys ALTER COLUMN monthly_message_limit SET DEFAULT 50;
ALTER TABLE api_keys ALTER COLUMN monthly_token_budget SET DEFAULT 100000;

-- ── RPC: increment_api_token_usage ──
-- Track token consumption alongside message count
CREATE OR REPLACE FUNCTION increment_api_token_usage(p_key_id UUID, p_tokens BIGINT)
RETURNS TABLE (token_limit_exceeded BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec api_keys%ROWTYPE;
BEGIN
  UPDATE api_keys
     SET monthly_tokens_used = monthly_tokens_used + p_tokens
   WHERE id = p_key_id
     AND status = 'active'
  RETURNING * INTO rec;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false;
    RETURN;
  END IF;

  RETURN QUERY SELECT (rec.monthly_tokens_used >= rec.monthly_token_budget);
END;
$$;

REVOKE ALL ON FUNCTION increment_api_token_usage(UUID, BIGINT) FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION increment_api_token_usage(UUID, BIGINT) TO service_role;

-- Must drop and recreate because return type changed
DROP FUNCTION IF EXISTS validate_api_key(TEXT);
CREATE OR REPLACE FUNCTION validate_api_key(p_key_hash TEXT)
RETURNS TABLE (
  key_id              UUID,
  key_user_id         UUID,
  key_name            TEXT,
  key_tier            TEXT,
  monthly_message_limit INT,
  rate_limit_per_min  INT,
  swarm_enabled       BOOLEAN,
  all_agents_enabled  BOOLEAN,
  streaming_enabled   BOOLEAN,
  monthly_message_count INT,
  monthly_window_start TIMESTAMPTZ,
  monthly_limit_exceeded BOOLEAN,
  monthly_token_budget BIGINT,
  monthly_tokens_used  BIGINT,
  token_limit_exceeded BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec api_keys%ROWTYPE;
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
           monthly_window_start = now(),
           last_used_at = now()
     WHERE api_keys.id = rec.id;
    rec.monthly_message_count := 0;
    rec.monthly_tokens_used := 0;
    rec.monthly_window_start := now();
  ELSE
    UPDATE api_keys SET last_used_at = now() WHERE api_keys.id = rec.id;
  END IF;

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
    (rec.monthly_tokens_used >= rec.monthly_token_budget);
END;
$$;

REVOKE ALL ON FUNCTION validate_api_key(TEXT) FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION validate_api_key(TEXT) TO service_role;
