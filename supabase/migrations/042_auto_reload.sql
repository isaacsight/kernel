-- Migration 042: Auto-reload image credits
-- Adds auto-reload settings to user_memory so credits replenish automatically
-- when they drop below a threshold after image generation.

-- New columns on user_memory
ALTER TABLE user_memory
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS auto_reload_pack TEXT DEFAULT NULL
    CHECK (auto_reload_pack IS NULL OR auto_reload_pack IN ('starter', 'standard', 'power')),
  ADD COLUMN IF NOT EXISTS auto_reload_threshold INT DEFAULT 5;

-- Get auto-reload settings for a user
CREATE OR REPLACE FUNCTION get_auto_reload(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pack TEXT;
  v_threshold INT;
  v_has_payment BOOLEAN;
BEGIN
  SELECT
    auto_reload_pack,
    COALESCE(auto_reload_threshold, 5),
    (stripe_customer_id IS NOT NULL)
  INTO v_pack, v_threshold, v_has_payment
  FROM user_memory
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'enabled', false,
      'pack', NULL,
      'threshold', 5,
      'has_payment_method', false
    );
  END IF;

  RETURN jsonb_build_object(
    'enabled', v_pack IS NOT NULL,
    'pack', v_pack,
    'threshold', v_threshold,
    'has_payment_method', v_has_payment
  );
END;
$$;

-- Set auto-reload preferences (p_pack = NULL disables)
CREATE OR REPLACE FUNCTION set_auto_reload(p_user_id UUID, p_pack TEXT, p_threshold INT DEFAULT 5)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate pack value
  IF p_pack IS NOT NULL AND p_pack NOT IN ('starter', 'standard', 'power') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_pack');
  END IF;

  -- Validate threshold
  IF p_threshold < 1 OR p_threshold > 50 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_threshold');
  END IF;

  UPDATE user_memory
  SET auto_reload_pack = p_pack,
      auto_reload_threshold = p_threshold
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_not_found');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Store Stripe customer ID (service_role only — called from webhook)
CREATE OR REPLACE FUNCTION set_stripe_customer_id(p_user_id UUID, p_customer_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_memory
  SET stripe_customer_id = p_customer_id
  WHERE user_id = p_user_id;
END;
$$;

-- Revoke direct access
REVOKE ALL ON FUNCTION get_auto_reload(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION set_auto_reload(UUID, TEXT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION set_stripe_customer_id(UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- Grant appropriate access
GRANT EXECUTE ON FUNCTION get_auto_reload(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION set_auto_reload(UUID, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION set_stripe_customer_id(UUID, TEXT) TO service_role;
