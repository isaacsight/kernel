ALTER TABLE agent_conversations ALTER COLUMN agent_id DROP NOT NULL;
ALTER TABLE agent_conversations ALTER COLUMN agent_id SET DEFAULT NULL;
