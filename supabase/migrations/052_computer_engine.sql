-- ─── Computer Engine — Sandboxed Compute ─────────────────────
-- Tables for tracking sandbox environments and execution history.

-- Sandboxes table
CREATE TABLE IF NOT EXISTS sandboxes (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL DEFAULT 'kernel',
    status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('creating', 'ready', 'busy', 'destroyed', 'error')),
    filesystem_snapshot JSONB DEFAULT '{"files": []}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_sandboxes_user_id ON sandboxes(user_id);
CREATE INDEX IF NOT EXISTS idx_sandboxes_status ON sandboxes(status) WHERE status != 'destroyed';

-- RLS: owner access only
ALTER TABLE sandboxes ENABLE ROW LEVEL SECURITY;

CREATE POLICY sandboxes_owner_select ON sandboxes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY sandboxes_owner_insert ON sandboxes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY sandboxes_owner_update ON sandboxes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY sandboxes_owner_delete ON sandboxes FOR DELETE USING (auth.uid() = user_id);

-- Sandbox execution history
CREATE TABLE IF NOT EXISTS sandbox_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sandbox_id TEXT NOT NULL REFERENCES sandboxes(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    input JSONB DEFAULT '{}'::jsonb,
    output JSONB DEFAULT '{}'::jsonb,
    duration_ms INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sandbox_executions_sandbox ON sandbox_executions(sandbox_id);

-- RLS: inherit from parent sandbox
ALTER TABLE sandbox_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY sandbox_executions_owner_select ON sandbox_executions
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM sandboxes WHERE sandboxes.id = sandbox_executions.sandbox_id AND sandboxes.user_id = auth.uid())
    );

CREATE POLICY sandbox_executions_owner_insert ON sandbox_executions
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM sandboxes WHERE sandboxes.id = sandbox_executions.sandbox_id AND sandboxes.user_id = auth.uid())
    );
