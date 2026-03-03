-- Platform Engine — Unified content orchestrator workflows
-- Tracks end-to-end pipelines: brief → create → score → adapt → distribute → monitor

CREATE TABLE IF NOT EXISTS platform_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  phases JSONB NOT NULL DEFAULT '[]'::jsonb,
  state TEXT NOT NULL DEFAULT 'idle' CHECK (state IN ('idle', 'running', 'awaiting_phase_approval', 'awaiting_content_approval', 'completed', 'failed', 'cancelled')),
  content_id UUID REFERENCES content_items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for user's workflow list
CREATE INDEX idx_platform_workflows_user ON platform_workflows(user_id, created_at DESC);

-- RLS: users manage their own workflows
ALTER TABLE platform_workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own workflows"
  ON platform_workflows FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workflows"
  ON platform_workflows FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workflows"
  ON platform_workflows FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own workflows"
  ON platform_workflows FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_platform_workflow_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER platform_workflow_updated
  BEFORE UPDATE ON platform_workflows
  FOR EACH ROW
  EXECUTE FUNCTION update_platform_workflow_timestamp();
