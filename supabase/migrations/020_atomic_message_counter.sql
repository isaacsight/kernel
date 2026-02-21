-- Migration 020: Atomic message counter for free-tier enforcement
-- Replaces client-controlled message_count with server-side atomic increment.
-- Prevents race conditions (two concurrent requests both reading count=9)
-- and client-side manipulation (never calling upsertUserMemory or passing 0).

CREATE OR REPLACE FUNCTION increment_message_count(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  -- Atomically upsert + increment, returning the new count.
  -- If the row doesn't exist, create it with count=1.
  -- If it exists, increment by 1.
  INSERT INTO user_memory (user_id, profile, message_count)
  VALUES (p_user_id, '{}'::jsonb, 1)
  ON CONFLICT (user_id)
  DO UPDATE SET message_count = user_memory.message_count + 1
  RETURNING message_count INTO v_count;

  RETURN v_count;
END;
$$;

-- Only callable via service role (edge functions), not by authenticated users directly
REVOKE ALL ON FUNCTION increment_message_count(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION increment_message_count(UUID) FROM authenticated;
REVOKE ALL ON FUNCTION increment_message_count(UUID) FROM anon;
