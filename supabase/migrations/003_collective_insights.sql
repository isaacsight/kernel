-- Collective intelligence: quality signals + aggregated insights

-- Store quality signals from each kernel response
CREATE TABLE IF NOT EXISTS response_signals (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
  topic TEXT,
  response_quality TEXT NOT NULL DEFAULT 'neutral',  -- 'helpful' | 'neutral' | 'poor'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_response_signals_user ON response_signals(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_response_signals_topic ON response_signals(topic);

ALTER TABLE response_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON response_signals FOR ALL USING (true) WITH CHECK (true);

-- Aggregated insights that the Kernel learns from
CREATE TABLE IF NOT EXISTS collective_insights (
  id TEXT PRIMARY KEY,
  insight_type TEXT NOT NULL,  -- 'topic_trend' | 'effective_pattern' | 'user_learning'
  content TEXT NOT NULL,
  strength REAL NOT NULL DEFAULT 0,  -- 0-1, how well-supported
  contributor_count INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collective_insights_strength ON collective_insights(strength DESC);

ALTER TABLE collective_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON collective_insights FOR ALL USING (true) WITH CHECK (true);
