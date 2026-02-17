-- Atomic view count increment for shared conversations
-- Prevents race conditions under concurrent requests

CREATE OR REPLACE FUNCTION increment_shared_view_count(share_id text)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE shared_conversations
  SET view_count = view_count + 1
  WHERE id = share_id;
$$;
