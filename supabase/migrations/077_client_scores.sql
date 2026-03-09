-- 077: Client Scoring System
-- Clients submit scores via hidden "kernel.hat" command
-- Used for invoicing based on satisfaction ratings

CREATE TABLE IF NOT EXISTS client_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id text REFERENCES conversations(id) ON DELETE SET NULL,
  score_type text NOT NULL CHECK (score_type IN ('project', 'session', 'work')),
  score integer NOT NULL CHECK (score >= 0 AND score <= 100),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_client_scores_user ON client_scores(user_id);
CREATE INDEX idx_client_scores_created ON client_scores(created_at DESC);
CREATE INDEX idx_client_scores_type ON client_scores(score_type);

-- RLS
ALTER TABLE client_scores ENABLE ROW LEVEL SECURITY;

-- Users can insert their own scores
CREATE POLICY "Users can insert own scores"
  ON client_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own scores
CREATE POLICY "Users can read own scores"
  ON client_scores FOR SELECT
  USING (auth.uid() = user_id);

-- Admin RPC to read all scores (for invoicing dashboard)
CREATE OR REPLACE FUNCTION get_all_client_scores()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  email text,
  conversation_id uuid,
  score_type text,
  score integer,
  notes text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    cs.id,
    cs.user_id,
    COALESCE(au.email, cs.user_id::text) AS email,
    cs.conversation_id,
    cs.score_type,
    cs.score,
    cs.notes,
    cs.created_at
  FROM client_scores cs
  LEFT JOIN auth.users au ON au.id = cs.user_id
  ORDER BY cs.created_at DESC;
$$;

-- Lock down the RPC
REVOKE EXECUTE ON FUNCTION get_all_client_scores() FROM public, anon;
GRANT EXECUTE ON FUNCTION get_all_client_scores() TO authenticated;

-- Aggregate scores per user for invoicing
CREATE OR REPLACE FUNCTION get_client_score_summary()
RETURNS TABLE (
  user_id uuid,
  email text,
  total_submissions bigint,
  avg_score numeric,
  avg_project numeric,
  avg_session numeric,
  avg_work numeric,
  latest_score_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    cs.user_id,
    COALESCE(au.email, cs.user_id::text) AS email,
    COUNT(*) AS total_submissions,
    ROUND(AVG(cs.score), 1) AS avg_score,
    ROUND(AVG(CASE WHEN cs.score_type = 'project' THEN cs.score END), 1) AS avg_project,
    ROUND(AVG(CASE WHEN cs.score_type = 'session' THEN cs.score END), 1) AS avg_session,
    ROUND(AVG(CASE WHEN cs.score_type = 'work' THEN cs.score END), 1) AS avg_work,
    MAX(cs.created_at) AS latest_score_at
  FROM client_scores cs
  LEFT JOIN auth.users au ON au.id = cs.user_id
  GROUP BY cs.user_id, au.email
  ORDER BY avg_score DESC;
$$;

REVOKE EXECUTE ON FUNCTION get_client_score_summary() FROM public, anon;
GRANT EXECUTE ON FUNCTION get_client_score_summary() TO authenticated;
