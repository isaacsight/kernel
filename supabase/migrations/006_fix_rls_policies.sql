-- Fix RLS policies: replace wide-open "Allow all for anon" with user-scoped policies
-- This is a critical security fix. All tables now enforce user isolation.

-- ═══════════════════════════════════════════════════════
-- 1. CONVERSATIONS — users can only access their own
-- ═══════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Allow all for anon" ON conversations;

CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own conversations"
  ON conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON conversations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON conversations FOR DELETE
  USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════
-- 2. MESSAGES — users can only access messages in their own conversations
-- ═══════════════════════════════════════════════════════

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Drop any existing open policies
DROP POLICY IF EXISTS "Allow all for anon" ON messages;
DROP POLICY IF EXISTS "Allow all for authenticated" ON messages;

CREATE POLICY "Users can view own messages"
  ON messages FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own messages"
  ON messages FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own messages"
  ON messages FOR DELETE
  USING (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════
-- 3. RESPONSE_SIGNALS — users can manage their own signals
-- ═══════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Allow all for anon" ON response_signals;

CREATE POLICY "Users can view own signals"
  ON response_signals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own signals"
  ON response_signals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own signals"
  ON response_signals FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════
-- 4. COLLECTIVE_INSIGHTS — read-only for users, write via service role
-- ═══════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Allow all for anon" ON collective_insights;

-- Everyone can read collective insights (they're shared learning)
CREATE POLICY "Anyone can view collective insights"
  ON collective_insights FOR SELECT
  USING (true);

-- Authenticated users can contribute insights (insert/update)
CREATE POLICY "Authenticated users can insert insights"
  ON collective_insights FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update insights"
  ON collective_insights FOR UPDATE
  USING (auth.role() = 'authenticated');

-- No DELETE policy — only service_role can delete insights.
