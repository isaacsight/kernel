-- Migration 019: Lock down wide-open RLS policies on legacy schema tables
-- These tables had anonymous access policies that allowed any unauthenticated
-- user to read/write all data. Replace with deny-all policies so only the
-- service role (used by edge functions) can access them.

-- ─── schema.sql tables ────────────────────────────────────────

-- inquiries
DROP POLICY IF EXISTS "Allow anonymous inserts" ON inquiries;
DROP POLICY IF EXISTS "Allow anonymous reads" ON inquiries;
DROP POLICY IF EXISTS "Allow anonymous updates" ON inquiries;
CREATE POLICY "Service role only" ON inquiries FOR ALL USING (false) WITH CHECK (false);

-- evaluation_conversations
DROP POLICY IF EXISTS "Allow anonymous inserts on eval_conversations" ON evaluation_conversations;
DROP POLICY IF EXISTS "Allow anonymous reads on eval_conversations" ON evaluation_conversations;
CREATE POLICY "Service role only" ON evaluation_conversations FOR ALL USING (false) WITH CHECK (false);

-- agent_insights
DROP POLICY IF EXISTS "Allow anonymous inserts on agent_insights" ON agent_insights;
DROP POLICY IF EXISTS "Allow anonymous reads on agent_insights" ON agent_insights;
DROP POLICY IF EXISTS "Allow anonymous updates on agent_insights" ON agent_insights;
CREATE POLICY "Service role only" ON agent_insights FOR ALL USING (false) WITH CHECK (false);

-- ─── schema-v2.sql tables ─────────────────────────────────────

DROP POLICY IF EXISTS "Allow all for anon" ON projects;
CREATE POLICY "Service role only" ON projects FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Allow all for anon" ON opportunities;
CREATE POLICY "Service role only" ON opportunities FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Allow all for anon" ON transactions;
CREATE POLICY "Service role only" ON transactions FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Allow all for anon" ON messages;
CREATE POLICY "Service role only" ON messages FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Allow all for anon" ON training_data;
CREATE POLICY "Service role only" ON training_data FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Allow all for anon" ON rlhf_feedback;
CREATE POLICY "Service role only" ON rlhf_feedback FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Allow all for anon" ON manage_sessions;
CREATE POLICY "Service role only" ON manage_sessions FOR ALL USING (false) WITH CHECK (false);
