-- Synthesis Dashboard — real-time visualization of kbot's closed-loop intelligence
-- The daemon pushes a snapshot every 15 minutes. The web page polls it.

CREATE TABLE IF NOT EXISTS kbot_synthesis_state (
  instance_id TEXT PRIMARY KEY DEFAULT 'primary',

  -- Synthesis Engine core
  total_cycles INTEGER DEFAULT 0,
  last_cycle_at TIMESTAMPTZ,
  stats JSONB DEFAULT '{}',

  -- Skill map (array of agent entries with mu/sigma/status)
  skill_map JSONB DEFAULT '[]',

  -- Active corrections (array)
  active_corrections JSONB DEFAULT '[]',

  -- Tool evaluations (array)
  tool_adoptions JSONB DEFAULT '[]',

  -- Paper insights (array)
  paper_insights JSONB DEFAULT '[]',

  -- Agent trials (array)
  agent_trials JSONB DEFAULT '[]',

  -- Topic weights
  topic_weights JSONB DEFAULT '[]',

  -- Discovery daemon state
  discovery_state JSONB DEFAULT '{}',
  pulse_data JSONB DEFAULT '{}',

  -- Learning store summaries (counts only)
  learning_summary JSONB DEFAULT '{}',

  -- Cross-pollination count
  cross_pollinated_count INTEGER DEFAULT 0,

  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Public read, service-role write
ALTER TABLE kbot_synthesis_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read synthesis state"
  ON kbot_synthesis_state FOR SELECT USING (true);

CREATE POLICY "Service role can write synthesis state"
  ON kbot_synthesis_state FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
