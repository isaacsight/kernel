-- 072: User-created matrix agents — persist custom agents per user across sessions
--
-- Each user can create up to 20 custom agents with a system prompt.
-- Agents sync between kbot sessions via the kernel-api edge function.

CREATE TABLE IF NOT EXISTS user_agents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id    TEXT NOT NULL,        -- slug (e.g., "security-auditor")
  name        TEXT NOT NULL,        -- display name (e.g., "Security Auditor")
  icon        TEXT NOT NULL DEFAULT '●',
  color       TEXT NOT NULL DEFAULT '#6B5B95',
  system_prompt TEXT NOT NULL,
  invocations INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT user_agents_unique_per_user UNIQUE (user_id, agent_id),
  CONSTRAINT user_agents_name_length CHECK (char_length(name) BETWEEN 1 AND 100),
  CONSTRAINT user_agents_prompt_length CHECK (char_length(system_prompt) BETWEEN 10 AND 10000)
);

-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_user_agents_user_id ON user_agents(user_id);

-- RLS: users can only access their own agents
ALTER TABLE user_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_agents_select ON user_agents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY user_agents_insert ON user_agents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_agents_update ON user_agents
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY user_agents_delete ON user_agents
  FOR DELETE USING (auth.uid() = user_id);

-- RPC: list user agents (for API key holders via service role)
CREATE OR REPLACE FUNCTION list_user_agents(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  agent_id TEXT,
  name TEXT,
  icon TEXT,
  color TEXT,
  system_prompt TEXT,
  invocations INT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT ua.id, ua.agent_id, ua.name, ua.icon, ua.color,
           ua.system_prompt, ua.invocations, ua.created_at
      FROM user_agents ua
     WHERE ua.user_id = p_user_id
     ORDER BY ua.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION list_user_agents(UUID) FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION list_user_agents(UUID) TO service_role;

-- RPC: upsert user agent
CREATE OR REPLACE FUNCTION upsert_user_agent(
  p_user_id UUID,
  p_agent_id TEXT,
  p_name TEXT,
  p_icon TEXT,
  p_color TEXT,
  p_system_prompt TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
  v_id UUID;
BEGIN
  -- Check max 20 agents per user
  SELECT count(*) INTO v_count FROM user_agents WHERE user_id = p_user_id;
  IF v_count >= 20 THEN
    RAISE EXCEPTION 'Maximum 20 agents per user';
  END IF;

  INSERT INTO user_agents (user_id, agent_id, name, icon, color, system_prompt)
  VALUES (p_user_id, p_agent_id, p_name, p_icon, p_color, p_system_prompt)
  ON CONFLICT (user_id, agent_id) DO UPDATE SET
    name = EXCLUDED.name,
    icon = EXCLUDED.icon,
    color = EXCLUDED.color,
    system_prompt = EXCLUDED.system_prompt,
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION upsert_user_agent(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION upsert_user_agent(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- RPC: increment agent invocation count
CREATE OR REPLACE FUNCTION increment_agent_invocation(p_user_id UUID, p_agent_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE user_agents
     SET invocations = invocations + 1,
         updated_at = now()
   WHERE user_id = p_user_id AND agent_id = p_agent_id;
END;
$$;

REVOKE ALL ON FUNCTION increment_agent_invocation(UUID, TEXT) FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION increment_agent_invocation(UUID, TEXT) TO service_role;

-- RPC: delete user agent
CREATE OR REPLACE FUNCTION delete_user_agent(p_user_id UUID, p_agent_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM user_agents WHERE user_id = p_user_id AND agent_id = p_agent_id;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION delete_user_agent(UUID, TEXT) FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION delete_user_agent(UUID, TEXT) TO service_role;
