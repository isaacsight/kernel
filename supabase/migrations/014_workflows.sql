-- Migration 014: Workflows
-- Enhance procedures table + add workflow_runs for execution history

-- Add columns to procedures
ALTER TABLE procedures ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE procedures ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT true;
ALTER TABLE procedures ADD COLUMN IF NOT EXISTS last_result TEXT DEFAULT NULL;
ALTER TABLE procedures ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE procedures ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Workflow execution history
CREATE TABLE IF NOT EXISTS workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  procedure_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  input TEXT DEFAULT '',
  output TEXT DEFAULT '',
  step_results JSONB DEFAULT '[]',
  duration_ms INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own workflow runs"
  ON workflow_runs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_user ON workflow_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_procedure ON workflow_runs(procedure_id);
