-- Consultation Engine — client profiles, threads, and message tracking
-- for kbot's autonomous email consultation service

-- ── Consultation Clients ──
CREATE TABLE IF NOT EXISTS consultation_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  industry TEXT,
  goals TEXT,
  challenges TEXT,
  context JSONB DEFAULT '{}',
  intake_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Consultation Threads ──
CREATE TABLE IF NOT EXISTS consultation_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES consultation_clients(id) ON DELETE CASCADE,
  subject TEXT NOT NULL DEFAULT '(no subject)',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('intake', 'valuation', 'awaiting_payment', 'active', 'completed', 'capped')),
  reply_count INTEGER DEFAULT 0,
  max_replies INTEGER DEFAULT 15,
  agent TEXT,
  quality_scores JSONB DEFAULT '[]',
  -- Valuation fields
  idea_summary TEXT,
  market_value_low INTEGER,        -- estimated low end in USD
  market_value_high INTEGER,       -- estimated high end in USD
  consultation_fee INTEGER,        -- fee in cents (Stripe format)
  valuation_analysis JSONB,        -- full analysis from kbot
  stripe_payment_link TEXT,        -- Stripe checkout URL
  stripe_session_id TEXT,          -- Stripe session ID
  paid BOOLEAN DEFAULT false,
  paid_at TIMESTAMPTZ,
  -- Summary fields
  summary TEXT,
  action_items JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- ── Consultation Messages (thread history) ──
CREATE TABLE IF NOT EXISTS consultation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES consultation_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('client', 'kbot')),
  content TEXT NOT NULL,
  eval_score JSONB,
  agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Indexes ──
CREATE INDEX IF NOT EXISTS idx_consultation_clients_email ON consultation_clients(email);
CREATE INDEX IF NOT EXISTS idx_consultation_threads_client ON consultation_threads(client_id);
CREATE INDEX IF NOT EXISTS idx_consultation_threads_status ON consultation_threads(status);
CREATE INDEX IF NOT EXISTS idx_consultation_messages_thread ON consultation_messages(thread_id);

-- ── RLS (service role only — no public access) ──
ALTER TABLE consultation_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultation_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultation_messages ENABLE ROW LEVEL SECURITY;

-- Service role bypass
CREATE POLICY "service_role_consultation_clients" ON consultation_clients
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_consultation_threads" ON consultation_threads
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_consultation_messages" ON consultation_messages
  FOR ALL USING (auth.role() = 'service_role');

-- ── Auto-update timestamp ──
CREATE OR REPLACE FUNCTION update_consultation_client_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_consultation_client_updated
  BEFORE UPDATE ON consultation_clients
  FOR EACH ROW
  EXECUTE FUNCTION update_consultation_client_timestamp();
