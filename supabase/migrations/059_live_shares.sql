-- Live Shares — collaborative real-time conversations
-- Allows conversation owners to create live share sessions that other users can join.

CREATE TABLE IF NOT EXISTS live_shares (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_code TEXT UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex'),
  is_active BOOLEAN NOT NULL DEFAULT true,
  max_participants INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_live_shares_conversation ON live_shares(conversation_id);
CREATE INDEX IF NOT EXISTS idx_live_shares_code ON live_shares(access_code) WHERE is_active = true;

ALTER TABLE live_shares ENABLE ROW LEVEL SECURITY;

-- Owner can manage their live shares
CREATE POLICY "Owners manage live shares" ON live_shares FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Anyone can read active shares (needed for join flow)
CREATE POLICY "Read active shares" ON live_shares FOR SELECT
  USING (is_active = true);


CREATE TABLE IF NOT EXISTS live_share_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_share_id TEXT NOT NULL REFERENCES live_shares(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'editor', 'viewer')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  kicked_at TIMESTAMPTZ DEFAULT NULL,
  UNIQUE(live_share_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_live_participants_share ON live_share_participants(live_share_id);

ALTER TABLE live_share_participants ENABLE ROW LEVEL SECURITY;

-- Participants can view their own entries
CREATE POLICY "View own participation" ON live_share_participants FOR SELECT
  USING (auth.uid() = user_id);

-- Share owners can view all participants
CREATE POLICY "Owners view participants" ON live_share_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM live_shares
      WHERE live_shares.id = live_share_participants.live_share_id
      AND live_shares.owner_id = auth.uid()
    )
  );

-- Share owners can manage participants (kick)
CREATE POLICY "Owners manage participants" ON live_share_participants FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM live_shares
      WHERE live_shares.id = live_share_participants.live_share_id
      AND live_shares.owner_id = auth.uid()
    )
  );

-- Users can insert themselves as participants (join)
CREATE POLICY "Users join shares" ON live_share_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow participants to read messages in shared conversations
-- This extends the existing conversations RLS
CREATE POLICY "Live share participants read conversations" ON conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM live_share_participants lsp
      JOIN live_shares ls ON ls.id = lsp.live_share_id
      WHERE ls.conversation_id = conversations.id
      AND lsp.user_id = auth.uid()
      AND lsp.kicked_at IS NULL
      AND ls.is_active = true
    )
  );
