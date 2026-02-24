-- Migration 025: Protect message_count from direct manipulation
-- Only the increment_message_count() RPC should modify this column.
-- Uses a session variable as a bypass token so the SECURITY DEFINER RPC
-- can still write, while direct user UPDATEs are rejected.

-- 1. Trigger function — rejects UPDATE if message_count changed without bypass token
CREATE OR REPLACE FUNCTION protect_message_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.message_count IS DISTINCT FROM OLD.message_count THEN
    IF current_setting('app.allow_message_count_update', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'Direct modification of message_count is not allowed. Use increment_message_count() instead.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Attach trigger to user_memory
DROP TRIGGER IF EXISTS trg_protect_message_count ON user_memory;
CREATE TRIGGER trg_protect_message_count
  BEFORE UPDATE ON user_memory
  FOR EACH ROW
  EXECUTE FUNCTION protect_message_count();

-- 3. Update increment_message_count() to set the bypass token
CREATE OR REPLACE FUNCTION increment_message_count(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  -- Set bypass token so the trigger allows this update
  PERFORM set_config('app.allow_message_count_update', 'true', true);

  INSERT INTO user_memory (user_id, profile, message_count)
  VALUES (p_user_id, '{}'::jsonb, 1)
  ON CONFLICT (user_id)
  DO UPDATE SET message_count = user_memory.message_count + 1
  RETURNING message_count INTO v_count;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION increment_message_count(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION increment_message_count(UUID) FROM authenticated;
REVOKE ALL ON FUNCTION increment_message_count(UUID) FROM anon;
