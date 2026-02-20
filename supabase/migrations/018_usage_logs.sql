-- Usage tracking for cost monitoring and alerts
-- Tracks token usage per API call with estimated cost

CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(10,6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fast daily aggregation by user
CREATE INDEX idx_usage_logs_user_daily ON usage_logs (user_id, created_at DESC);

-- RLS: only service role can read/write (no public policies)
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
