-- Migration 021: Restore RLS access for tables the frontend app uses
-- Migration 019 locked these with deny-all policies, but the app accesses
-- them via the anon/authenticated key (not service role).

-- ─── messages ─────────────────────────────────────────────────
-- Critical: all chat persistence. Users must manage their own messages.
DROP POLICY IF EXISTS "Service role only" ON messages;
CREATE POLICY "Users can read own messages"
  ON messages FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own messages"
  ON messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own messages"
  ON messages FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own messages"
  ON messages FOR DELETE
  USING (auth.uid() = user_id);

-- ─── projects, opportunities, transactions ────────────────────
-- These are admin/business tables without user_id columns.
-- Allow authenticated users full access (single-user app).
DROP POLICY IF EXISTS "Service role only" ON projects;
CREATE POLICY "Authenticated users can manage projects"
  ON projects FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Service role only" ON opportunities;
CREATE POLICY "Authenticated users can manage opportunities"
  ON opportunities FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Service role only" ON transactions;
CREATE POLICY "Authenticated users can manage transactions"
  ON transactions FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
