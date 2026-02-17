-- Migration 016: Briefings
-- Personalized daily news summaries

CREATE TABLE IF NOT EXISTS briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  topics TEXT[] DEFAULT '{}',
  sources JSONB DEFAULT '[]',
  read_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own briefings"
  ON briefings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_briefings_user ON briefings(user_id);
CREATE INDEX IF NOT EXISTS idx_briefings_date ON briefings(user_id, created_at);
