-- 074: Unified billing — single subscription pool for web + API
--
-- Core change: API keys inherit tier from user's subscription.
-- Message counting unified via user_memory (shared pool).
-- Overage tracked on subscriptions table only.
--
-- Unified tier matrix (Option C):
--   Free:   30 msgs/mo,   10/day,  10/min,  hard cap
--   Pro:    1000 msgs/mo, 100/day, 60/min,  $0.05/msg overage ($39/mo)
--   Max:    6000 msgs/mo, 500/day, 180/min, $0.04/msg overage ($249/mo)

-- ── 1. Add spending alert columns to subscriptions ────────────────
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS alert_80_sent BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS alert_100_sent BOOLEAN NOT NULL DEFAULT false;

-- ── 2. Update overage rates on existing subscriptions ─────────────
-- Pro: 30 millicents → 50 millicents ($0.03 → $0.05)
-- Max: 25 millicents → 40 millicents ($0.025 → $0.04)
UPDATE subscriptions SET overage_rate_millicents = 50
  WHERE status IN ('active', 'trialing') AND plan IN ('pro_monthly', 'pro_annual');
UPDATE subscriptions SET overage_rate_millicents = 40
  WHERE status IN ('active', 'trialing') AND plan IN ('max_monthly', 'max_annual');

-- ── 3. Rewrite validate_api_key — resolve tier from subscriptions ─
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
  v_key_id       UUID;
  v_key_user_id  UUID;
  v_key_name     TEXT;
  v_token_budget BIGINT;
  v_tokens_used  BIGINT;
  v_sub          RECORD;
  v_sub_found    BOOLEAN := false;
  v_tier         TEXT;
  v_msg_limit    INT;
  v_rate_limit   INT;
  v_swarm        BOOLEAN;
  v_all_agents   BOOLEAN;
  v_streaming    BOOLEAN;
  v_msg_count    INT;
  v_window_start TIMESTAMPTZ;
  v_ov_enabled   BOOLEAN;
  v_ov_rate      INT;
  v_ov_count     INT;
  v_max_spend    INT;
  v_cur_spend    INT;
BEGIN
  -- 1. Find key by hash (thin lookup — only identity + token budget)
  SELECT ak.id, ak.user_id, ak.name, ak.monthly_token_budget, ak.monthly_tokens_used
    INTO v_key_id, v_key_user_id, v_key_name, v_token_budget, v_tokens_used
    FROM api_keys ak
   WHERE ak.key_hash = p_key_hash
     AND ak.status = 'active';

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE api_keys SET last_used_at = now() WHERE api_keys.id = v_key_id;

  -- 2. Look up user's subscription for tier + overage
  SELECT s.plan,
         s.overage_enabled, s.overage_rate_millicents,
         s.overage_count, s.max_monthly_spend_cents
    INTO v_sub
    FROM subscriptions s
   WHERE s.user_id = v_key_user_id
     AND s.status IN ('active', 'trialing')
   LIMIT 1;

  v_sub_found := FOUND;

  -- 3. Resolve effective tier
  IF NOT v_sub_found THEN
    v_tier := 'free';
  ELSIF v_sub.plan IN ('max_monthly', 'max_annual') THEN
    v_tier := 'max';
  ELSIF v_sub.plan IN ('pro_monthly', 'pro_annual') THEN
    v_tier := 'pro';
  ELSE
    v_tier := 'pro';
  END IF;

  -- 4. Derive limits from tier (Option C)
  CASE v_tier
    WHEN 'free' THEN
      v_msg_limit := 30;  v_rate_limit := 10;
      v_swarm := false;   v_all_agents := false;  v_streaming := false;
    WHEN 'pro' THEN
      v_msg_limit := 1000;  v_rate_limit := 60;
      v_swarm := true;      v_all_agents := true;   v_streaming := true;
    WHEN 'max' THEN
      v_msg_limit := 6000;  v_rate_limit := 180;
      v_swarm := true;      v_all_agents := true;   v_streaming := true;
  END CASE;

  -- 5. Get unified message count from user_memory (shared pool)
  SELECT COALESCE(um.monthly_message_count, 0), um.monthly_window_start
    INTO v_msg_count, v_window_start
    FROM user_memory um
   WHERE um.user_id = v_key_user_id;

  IF NOT FOUND THEN
    v_msg_count := 0;
    v_window_start := now();
  END IF;

  IF v_window_start IS NULL OR (now() - v_window_start) > INTERVAL '30 days' THEN
    v_msg_count := 0;
  END IF;

  -- 6. Overage from subscription
  IF v_sub_found AND v_sub.overage_enabled THEN
    v_ov_enabled := true;
    v_ov_rate    := COALESCE(v_sub.overage_rate_millicents, 0);
    v_ov_count   := COALESCE(v_sub.overage_count, 0);
    v_max_spend  := v_sub.max_monthly_spend_cents;
  ELSE
    v_ov_enabled := false;
    v_ov_rate    := 0;
    v_ov_count   := 0;
    v_max_spend  := NULL;
  END IF;

  v_cur_spend := v_ov_count * v_ov_rate;

  RETURN QUERY SELECT
    v_key_id,
    v_key_user_id,
    v_key_name,
    v_tier,
    v_msg_limit,
    v_rate_limit,
    v_swarm,
    v_all_agents,
    v_streaming,
    v_msg_count,
    COALESCE(v_window_start, now()),
    (v_msg_count >= v_msg_limit),
    v_token_budget,
    v_tokens_used,
    (v_tokens_used >= v_token_budget),
    v_ov_enabled,
    v_ov_rate,
    v_ov_count,
    v_max_spend,
    (v_max_spend IS NOT NULL AND v_cur_spend >= v_max_spend * 10);
END;
$$;

REVOKE ALL ON FUNCTION validate_api_key(TEXT) FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION validate_api_key(TEXT) TO service_role;


-- ── 4. Update increment_web_overage — unified limits ──────────────
CREATE OR REPLACE FUNCTION increment_web_overage(p_user_id UUID)
RETURNS TABLE (new_overage_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan TEXT;
  v_limit INT;
  v_monthly_count INT;
  v_result INT;
BEGIN
  SELECT plan INTO v_plan
    FROM subscriptions
   WHERE user_id = p_user_id
     AND status IN ('active', 'trialing')
     AND overage_enabled = true;

  IF NOT FOUND THEN
    new_overage_count := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Unified limits (Option C)
  v_limit := CASE v_plan
    WHEN 'pro_monthly' THEN 1000
    WHEN 'pro_annual'  THEN 1000
    WHEN 'max_monthly' THEN 6000
    WHEN 'max_annual'  THEN 6000
    ELSE 30
  END;

  SELECT COALESCE(monthly_message_count, 0) INTO v_monthly_count
    FROM user_memory
   WHERE user_id = p_user_id;

  IF NOT FOUND OR v_monthly_count <= v_limit THEN
    new_overage_count := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE subscriptions
     SET overage_count = overage_count + 1,
         updated_at = now()
   WHERE user_id = p_user_id
     AND status IN ('active', 'trialing')
     AND overage_enabled = true
  RETURNING overage_count INTO v_result;

  new_overage_count := COALESCE(v_result, 0);
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION increment_web_overage(UUID) FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION increment_web_overage(UUID) TO service_role;
