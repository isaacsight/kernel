-- Migration 033: Convergence — Multi-agent perception synthesis
-- Adds agent facets and convergence insights to user_memory
-- Each agent maintains a "facet" (its angle on who the user is).
-- Convergence is where facets meet and emergent insights appear.

ALTER TABLE user_memory
  ADD COLUMN IF NOT EXISTS agent_facets JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS convergence_insights JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS last_convergence TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN user_memory.agent_facets IS 'Per-agent perception facets: {agentId: {observations, patterns, updatedAt, messagesSeen}}';
COMMENT ON COLUMN user_memory.convergence_insights IS 'Emergent insights from inter-agent convergence: [{insight, sources, confidence, createdAt}]';
COMMENT ON COLUMN user_memory.last_convergence IS 'Timestamp of last convergence run';
