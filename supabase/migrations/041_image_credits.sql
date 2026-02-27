-- Migration 041: Image credit system
-- Adds image_credits column to user_memory and RPCs for credit management.

-- Image credits column
ALTER TABLE user_memory
  ADD COLUMN IF NOT EXISTS image_credits INT DEFAULT 0;

-- Check credits (read-only)
CREATE OR REPLACE FUNCTION check_image_credits(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_credits INT;
BEGIN
  SELECT COALESCE(image_credits, 0) INTO v_credits
  FROM user_memory WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('credits', 0);
  END IF;

  RETURN jsonb_build_object('credits', v_credits);
END;
$$;

-- Decrement credits (atomic, returns new balance)
CREATE OR REPLACE FUNCTION decrement_image_credit(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_credits INT;
BEGIN
  UPDATE user_memory
  SET image_credits = image_credits - 1
  WHERE user_id = p_user_id AND image_credits > 0
  RETURNING image_credits INTO v_credits;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'credits', 0, 'error', 'no_credits');
  END IF;

  RETURN jsonb_build_object('success', true, 'credits', v_credits);
END;
$$;

-- Add credits (for webhook after purchase)
CREATE OR REPLACE FUNCTION add_image_credits(p_user_id UUID, p_amount INT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_credits INT;
BEGIN
  INSERT INTO user_memory (user_id, image_credits)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id) DO UPDATE
  SET image_credits = user_memory.image_credits + p_amount
  RETURNING image_credits INTO v_credits;

  RETURN jsonb_build_object('success', true, 'credits', v_credits);
END;
$$;

-- Revoke direct access
REVOKE ALL ON FUNCTION check_image_credits(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION decrement_image_credit(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION add_image_credits(UUID, INT) FROM PUBLIC, anon, authenticated;

-- Grant execute to authenticated (RPCs check auth server-side)
GRANT EXECUTE ON FUNCTION check_image_credits(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION decrement_image_credit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION add_image_credits(UUID, INT) TO service_role;
