-- Schema V2: Missing tables for the agent swarm
-- Run against: postgresql://postgres:***@db.eoxxpyixdieprsxlpwcs.supabase.co:5432/postgres

-- Projects: client projects with status tracking
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY DEFAULT 'proj_' || extract(epoch from now())::bigint || '_' || substr(md5(random()::text), 1, 9),
  client_name TEXT NOT NULL,
  client_email TEXT,
  description TEXT NOT NULL,
  project_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'quoted' CHECK (status IN ('quoted', 'paid', 'in_progress', 'delivered', 'completed')),
  quoted_price NUMERIC NOT NULL DEFAULT 0,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Opportunities: leads from scout analysis
CREATE TABLE IF NOT EXISTS opportunities (
  id TEXT PRIMARY KEY DEFAULT 'opp_' || extract(epoch from now())::bigint || '_' || substr(md5(random()::text), 1, 9),
  source TEXT NOT NULL,
  url TEXT,
  author TEXT NOT NULL,
  content TEXT NOT NULL,
  is_viable BOOLEAN NOT NULL DEFAULT false,
  project_type TEXT,
  estimated_value NUMERIC NOT NULL DEFAULT 0,
  urgency TEXT NOT NULL DEFAULT 'medium',
  confidence NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'converted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Transactions: revenue/expense tracking
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('revenue', 'expense', 'trading_profit', 'trading_loss')),
  amount NUMERIC NOT NULL,
  description TEXT NOT NULL,
  project_id TEXT REFERENCES projects(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Messages: conversation persistence for agent channels
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY DEFAULT 'msg_' || extract(epoch from now())::bigint || '_' || substr(md5(random()::text), 1, 9),
  channel_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_calls JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id, created_at);

-- Training data: LLM training examples
CREATE TABLE IF NOT EXISTS training_data (
  id TEXT PRIMARY KEY DEFAULT 'td_' || extract(epoch from now())::bigint || '_' || substr(md5(random()::text), 1, 9),
  category TEXT NOT NULL,
  input TEXT NOT NULL,
  output TEXT NOT NULL,
  quality_score NUMERIC DEFAULT 0,
  source TEXT DEFAULT 'synthetic',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_training_data_category ON training_data(category);

-- RLHF feedback: reasoning feedback
CREATE TABLE IF NOT EXISTS rlhf_feedback (
  id TEXT PRIMARY KEY,
  reasoning_id TEXT NOT NULL,
  rating TEXT NOT NULL CHECK (rating IN ('positive', 'negative')),
  context TEXT NOT NULL,
  conclusion TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Manage sessions: management agent conversation persistence
CREATE TABLE IF NOT EXISTS manage_sessions (
  id TEXT PRIMARY KEY DEFAULT 'ms_' || extract(epoch from now())::bigint || '_' || substr(md5(random()::text), 1, 9),
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE rlhf_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE manage_sessions ENABLE ROW LEVEL SECURITY;

-- Allow anon/service role full access (edge functions use service role)
CREATE POLICY "Allow all for anon" ON projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON opportunities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON training_data FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON rlhf_feedback FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON manage_sessions FOR ALL USING (true) WITH CHECK (true);
