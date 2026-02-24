-- Migration 026: Protect message_count from client-side manipulation
--
-- VULNERABILITY: The "Users can manage own memory" policy (migration 004) grants
-- FOR ALL on user_memory, allowing authenticated users to directly UPDATE
-- message_count and count_date via the Supabase client:
--
--   supabase.from('user_memory').update({ message_count: 0 }).eq('user_id', myId)
--
-- This bypasses the atomic increment_message_count() function (migration 020/025),
-- giving free-tier users unlimited daily messages.
--
-- FIX: Replace the broad FOR ALL policy with granular per-operation policies,
-- and use column-level privileges to prevent client writes to message_count
-- and count_date. The SECURITY DEFINER increment_message_count() function
-- runs as the postgres owner and retains full column access.

-- Step 1: Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can manage own memory" ON user_memory;

-- Step 2: Create granular RLS policies (same auth check, per-operation)
CREATE POLICY "user_memory_select" ON user_memory
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_memory_insert" ON user_memory
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_memory_update" ON user_memory
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_memory_delete" ON user_memory
  FOR DELETE USING (auth.uid() = user_id);

-- Step 3: Column-level privilege restriction
-- Revoke broad table-level INSERT/UPDATE from authenticated role,
-- then grant only on safe columns (profile, updated_at).
-- message_count and count_date become service-role-only writable.
REVOKE INSERT ON user_memory FROM authenticated;
REVOKE UPDATE ON user_memory FROM authenticated;

GRANT INSERT (user_id, profile, updated_at) ON user_memory TO authenticated;
GRANT UPDATE (profile, updated_at) ON user_memory TO authenticated;

-- Defense in depth: ensure anon role has no write access
REVOKE INSERT ON user_memory FROM anon;
REVOKE UPDATE ON user_memory FROM anon;
REVOKE DELETE ON user_memory FROM anon;
