-- Agent Conversations: add email-based agent columns
ALTER TABLE agent_conversations ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE agent_conversations ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE agent_conversations ADD COLUMN IF NOT EXISTS role text;
ALTER TABLE agent_conversations ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE agent_conversations ADD COLUMN IF NOT EXISTS subject text;

CREATE INDEX IF NOT EXISTS idx_agent_conv_email ON agent_conversations(email);
