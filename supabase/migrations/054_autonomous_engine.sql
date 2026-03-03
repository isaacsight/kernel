-- ─── Autonomous Engine — Background Agents & Adaptive Routing ────
-- Tables for background agents, execution history, outcome tracking,
-- and adaptive routing weights.

-- Background agents table
CREATE TABLE IF NOT EXISTS background_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    trigger JSONB NOT NULL DEFAULT '{"type": "schedule", "cron": "every_1h"}'::jsonb,
    agent_config JSONB NOT NULL DEFAULT '{"persona": "", "tools": []}'::jsonb,
    enabled BOOLEAN NOT NULL DEFAULT true,
    last_run_at TIMESTAMPTZ,
    run_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_background_agents_user ON background_agents(user_id);
CREATE INDEX IF NOT EXISTS idx_background_agents_enabled ON background_agents(user_id, enabled) WHERE enabled = true;

-- RLS: owner access only
ALTER TABLE background_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY background_agents_owner_select ON background_agents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY background_agents_owner_insert ON background_agents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY background_agents_owner_update ON background_agents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY background_agents_owner_delete ON background_agents FOR DELETE USING (auth.uid() = user_id);

-- Background agent run history
CREATE TABLE IF NOT EXISTS background_agent_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES background_agents(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
    output TEXT DEFAULT '',
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_bg_agent_runs_agent ON background_agent_runs(agent_id);
CREATE INDEX IF NOT EXISTS idx_bg_agent_runs_status ON background_agent_runs(status) WHERE status = 'running';

-- RLS: inherit from parent agent
ALTER TABLE background_agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY bg_agent_runs_owner_select ON background_agent_runs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM background_agents WHERE background_agents.id = background_agent_runs.agent_id AND background_agents.user_id = auth.uid())
    );

CREATE POLICY bg_agent_runs_owner_insert ON background_agent_runs
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM background_agents WHERE background_agents.id = background_agent_runs.agent_id AND background_agents.user_id = auth.uid())
    );

CREATE POLICY bg_agent_runs_owner_update ON background_agent_runs
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM background_agents WHERE background_agents.id = background_agent_runs.agent_id AND background_agents.user_id = auth.uid())
    );

-- Agent outcomes for quality tracking
CREATE TABLE IF NOT EXISTS agent_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id TEXT NOT NULL,
    intent_type TEXT NOT NULL,
    quality_score FLOAT NOT NULL DEFAULT 0.5,
    user_signal TEXT NOT NULL DEFAULT 'neutral' CHECK (user_signal IN ('positive', 'neutral', 'negative')),
    recorded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_outcomes_agent ON agent_outcomes(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_outcomes_intent ON agent_outcomes(intent_type);
CREATE INDEX IF NOT EXISTS idx_agent_outcomes_recorded ON agent_outcomes(recorded_at DESC);

-- RLS: authenticated users can insert and read their own outcomes
ALTER TABLE agent_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_outcomes_authenticated_select ON agent_outcomes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY agent_outcomes_authenticated_insert ON agent_outcomes FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Routing weights — adaptive agent selection
CREATE TABLE IF NOT EXISTS routing_weights (
    agent_id TEXT NOT NULL,
    intent_type TEXT NOT NULL,
    weight FLOAT NOT NULL DEFAULT 1.0,
    sample_count INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (agent_id, intent_type)
);

CREATE INDEX IF NOT EXISTS idx_routing_weights_agent ON routing_weights(agent_id);

-- RLS: authenticated users can read; system upserts
ALTER TABLE routing_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY routing_weights_authenticated_select ON routing_weights FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY routing_weights_authenticated_insert ON routing_weights FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY routing_weights_authenticated_update ON routing_weights FOR UPDATE USING (auth.role() = 'authenticated');
