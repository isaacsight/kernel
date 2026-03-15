-- Migration 082: Real-time overage reporting
-- Returns stripe_customer_id from increment_web_overage so claude-proxy
-- can report meter events to Stripe immediately (no hourly delay).

DROP FUNCTION IF EXISTS increment_web_overage(UUID);

CREATE FUNCTION increment_web_overage(p_user_id UUID)
RETURNS TABLE (new_overage_count INT, stripe_customer_id TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan TEXT;
  v_limit INT;
  v_monthly_count INT;
  v_result INT;
  v_customer_id TEXT;
BEGIN
  SELECT s.plan, s.stripe_customer_id INTO v_plan, v_customer_id
    FROM subscriptions s
   WHERE s.user_id = p_user_id
     AND s.status IN ('active', 'trialing')
     AND s.overage_enabled = true;

  IF NOT FOUND THEN
    new_overage_count := 0;
    stripe_customer_id := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Pro = 200 msgs/month
  v_limit := CASE v_plan
    WHEN 'pro_monthly' THEN 200
    ELSE 10
  END;

  SELECT COALESCE(monthly_message_count, 0) INTO v_monthly_count
    FROM user_memory
   WHERE user_id = p_user_id;

  IF NOT FOUND OR v_monthly_count <= v_limit THEN
    new_overage_count := 0;
    stripe_customer_id := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE subscriptions
     SET overage_count = overage_count + 1,
         overage_rate_millicents = 100,
         last_reported_overage_count = overage_count + 1,
         last_overage_reported_at = now(),
         updated_at = now()
   WHERE user_id = p_user_id
     AND status IN ('active', 'trialing')
     AND overage_enabled = true
  RETURNING overage_count, subscriptions.stripe_customer_id
    INTO v_result, v_customer_id;

  new_overage_count := COALESCE(v_result, 0);
  stripe_customer_id := v_customer_id;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION increment_web_overage(UUID) FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION increment_web_overage(UUID) TO service_role;
