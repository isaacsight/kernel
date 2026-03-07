-- Migration 074: Usage-based credit balance system
-- Replaces subscription tiers with prepaid credits. Users buy credit packs,
-- each API call deducts based on actual token cost.

-- Credit balance column on user_memory (cents, e.g. 500 = $5.00)
ALTER TABLE user_memory
  ADD COLUMN IF NOT EXISTS credit_balance_cents INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifetime_credits_purchased_cents INT DEFAULT 0;

-- Check credit balance (read-only, authenticated users)
CREATE OR REPLACE FUNCTION check_credit_balance(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance INT;
BEGIN
  SELECT COALESCE(credit_balance_cents, 0) INTO v_balance
  FROM user_memory WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('balance_cents', 0);
  END IF;

  RETURN jsonb_build_object('balance_cents', v_balance);
END;
$$;

-- Deduct credits atomically after an API call.
-- p_cost_cents is the cost in fractional cents (microcents stored as numeric).
-- We use numeric(10,4) to handle sub-cent costs accurately.
-- Returns success, new balance, and whether balance is low.
CREATE OR REPLACE FUNCTION deduct_credits(p_user_id UUID, p_cost_microcents NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance INT;
  v_cost_cents NUMERIC;
BEGIN
  -- Convert microcents to cents (round up to nearest cent for deduction)
  v_cost_cents := CEIL(p_cost_microcents / 10000.0);

  -- Ensure minimum 1 cent charge
  IF v_cost_cents < 1 THEN
    v_cost_cents := 1;
  END IF;

  UPDATE user_memory
  SET credit_balance_cents = credit_balance_cents - v_cost_cents::INT
  WHERE user_id = p_user_id AND credit_balance_cents >= v_cost_cents
  RETURNING credit_balance_cents INTO v_balance;

  IF NOT FOUND THEN
    -- Check if user exists but has insufficient balance
    SELECT COALESCE(credit_balance_cents, 0) INTO v_balance
    FROM user_memory WHERE user_id = p_user_id;

    RETURN jsonb_build_object(
      'success', false,
      'balance_cents', COALESCE(v_balance, 0),
      'error', 'insufficient_credits'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'balance_cents', v_balance,
    'charged_cents', v_cost_cents::INT,
    'low_balance', v_balance < 100  -- warn when below $1
  );
END;
$$;

-- Add credits after purchase (service_role only — called from webhook)
CREATE OR REPLACE FUNCTION add_credits(p_user_id UUID, p_amount_cents INT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance INT;
BEGIN
  INSERT INTO user_memory (user_id, credit_balance_cents, lifetime_credits_purchased_cents)
  VALUES (p_user_id, p_amount_cents, p_amount_cents)
  ON CONFLICT (user_id) DO UPDATE
  SET credit_balance_cents = user_memory.credit_balance_cents + p_amount_cents,
      lifetime_credits_purchased_cents = COALESCE(user_memory.lifetime_credits_purchased_cents, 0) + p_amount_cents
  RETURNING credit_balance_cents INTO v_balance;

  RETURN jsonb_build_object('success', true, 'balance_cents', v_balance);
END;
$$;

-- Revoke direct access
REVOKE ALL ON FUNCTION check_credit_balance(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION deduct_credits(UUID, NUMERIC) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION add_credits(UUID, INT) FROM PUBLIC, anon, authenticated;

-- Grant appropriate access
GRANT EXECUTE ON FUNCTION check_credit_balance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION deduct_credits(UUID, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION add_credits(UUID, INT) TO service_role;
