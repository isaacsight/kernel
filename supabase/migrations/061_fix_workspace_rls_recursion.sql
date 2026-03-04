-- Fix infinite recursion in workspace_members RLS policies.
-- The "Members view members" policy queries workspace_members from within
-- a workspace_members SELECT policy, causing infinite recursion.
-- Solution: SECURITY DEFINER functions bypass RLS for the membership check.

CREATE OR REPLACE FUNCTION is_workspace_member(ws_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = ws_id
    AND user_id = auth.uid()
    AND accepted_at IS NOT NULL
    AND removed_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION is_workspace_admin(ws_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = ws_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin')
    AND removed_at IS NULL
  );
$$;

-- Drop recursive policies
DROP POLICY IF EXISTS "Members view members" ON workspace_members;
DROP POLICY IF EXISTS "Admins manage members" ON workspace_members;
DROP POLICY IF EXISTS "Members view workspace" ON workspaces;
DROP POLICY IF EXISTS "Admins manage invitations" ON workspace_invitations;
DROP POLICY IF EXISTS "Workspace members view conversations" ON conversations;

-- Recreate with SECURITY DEFINER functions (no recursion)

-- workspace_members: users can see their own rows + other members in same workspace
CREATE POLICY "Members view members" ON workspace_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR is_workspace_member(workspace_id)
  );

-- workspace_members: admins/owners can manage (insert/update/delete)
CREATE POLICY "Admins manage members" ON workspace_members FOR ALL
  USING (is_workspace_admin(workspace_id));

-- workspaces: owners + accepted members can view
CREATE POLICY "Members view workspace" ON workspaces FOR SELECT
  USING (
    auth.uid() = owner_id
    OR is_workspace_member(id)
  );

-- workspace_invitations: admins/owners can manage
CREATE POLICY "Admins manage invitations" ON workspace_invitations FOR ALL
  USING (is_workspace_admin(workspace_id));

-- conversations: workspace members can view workspace conversations
CREATE POLICY "Workspace members view conversations" ON conversations FOR SELECT
  USING (
    workspace_id IS NOT NULL
    AND is_workspace_member(workspace_id)
  );
