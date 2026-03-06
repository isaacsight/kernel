-- 073: Web overage billing — allow paid web users to exceed monthly limits
--
-- Pro:  1,000 base + $0.03/msg overage  (matches API pro rate)
-- Max:  6,000 base + $0.025/msg overage (matches API growth rate)
-- Free: hard cap (no overage)

-- ── New columns on subscriptions ─────────────────────────────
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS overage_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS overage_rate_millicents INT NOT NULL DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS overage_count INT NOT NULL DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS last_reported_overage_count INT NOT NULL DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS max_monthly_spend_cents INT DEFAULT NULL;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS last_overage_reported_at TIMESTAMPTZ;

-- ── Enable overage for existing paid subscriptions ───────────
UPDATE subscriptions SET overage_enabled = true, overage_rate_millicents = 30
  WHERE status IN ('active', 'trialing') AND plan IN ('pro_monthly', 'pro_annual');
UPDATE subscriptions SET overage_enabled = true, overage_rate_millicents = 25
  WHERE status IN ('active', 'trialing') AND plan IN ('max_monthly', 'max_annual');

-- ── RPC: increment web overage count (only when past plan limit) ──
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
  -- Get plan from subscription
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

  -- Determine monthly limit based on plan
  v_limit := CASE v_plan
    WHEN 'pro_monthly' THEN 1000
    WHEN 'pro_annual'  THEN 1500
    WHEN 'max_monthly' THEN 6000
    WHEN 'max_annual'  THEN 6000
    ELSE 40
  END;

  -- Check current monthly message count
  SELECT COALESCE(monthly_message_count, 0) INTO v_monthly_count
    FROM user_memory
   WHERE user_id = p_user_id;

  IF NOT FOUND OR v_monthly_count <= v_limit THEN
    new_overage_count := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Past limit: increment overage
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
