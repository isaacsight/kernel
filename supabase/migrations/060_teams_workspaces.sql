-- Team Workspaces — multi-user collaboration tier
-- Adds workspace management, member invitations, and shared conversations.

CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  max_members INTEGER NOT NULL DEFAULT 10,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON workspaces(slug);

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

-- Members can view workspace
CREATE POLICY "Members view workspace" ON workspaces FOR SELECT
  USING (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = workspaces.id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.accepted_at IS NOT NULL
      AND workspace_members.removed_at IS NULL
    )
  );

-- Owner can update workspace
CREATE POLICY "Owner updates workspace" ON workspaces FOR UPDATE
  USING (auth.uid() = owner_id);

-- Authenticated users can create workspaces
CREATE POLICY "Users create workspaces" ON workspaces FOR INSERT
  WITH CHECK (auth.uid() = owner_id);


CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  accepted_at TIMESTAMPTZ,
  removed_at TIMESTAMPTZ,
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);

ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- Members can view other members in same workspace
CREATE POLICY "Members view members" ON workspace_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.accepted_at IS NOT NULL
      AND wm.removed_at IS NULL
    )
  );

-- Admins/owners can manage members
CREATE POLICY "Admins manage members" ON workspace_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
      AND wm.removed_at IS NULL
    )
  );

-- Users can insert themselves (accept invitation)
CREATE POLICY "Users accept invitations" ON workspace_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);


CREATE TABLE IF NOT EXISTS workspace_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  invite_code TEXT UNIQUE DEFAULT encode(gen_random_bytes(8), 'hex'),
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_workspace_invitations_code ON workspace_invitations(invite_code);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_email ON workspace_invitations(email);

ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;

-- Workspace admins/owners can manage invitations
CREATE POLICY "Admins manage invitations" ON workspace_invitations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_invitations.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
      AND wm.removed_at IS NULL
    )
  );

-- Anyone can read invitations by code (for accept flow)
CREATE POLICY "Read invitations by code" ON workspace_invitations FOR SELECT
  USING (true);


-- Add workspace_id to conversations and folders
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS workspace_id UUID
  REFERENCES workspaces(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_workspace ON conversations(workspace_id);

ALTER TABLE conversation_folders ADD COLUMN IF NOT EXISTS workspace_id UUID
  REFERENCES workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_folders_workspace ON conversation_folders(workspace_id);

-- Members can view workspace conversations
CREATE POLICY "Workspace members view conversations" ON conversations FOR SELECT
  USING (
    workspace_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = conversations.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.accepted_at IS NOT NULL
      AND wm.removed_at IS NULL
    )
  );
