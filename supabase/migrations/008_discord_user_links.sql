-- 008: Discord user links + Discord user memory
-- Enables cross-platform conversation continuity between Discord and web.

-- ─── Discord User Links ─────────────────────────────────────
-- Maps Discord user IDs to Supabase auth users for cross-platform sync.
-- A Discord user linked to a Supabase user can see their Discord
-- conversations in the web app and vice versa.

CREATE TABLE IF NOT EXISTS discord_user_links (
  discord_id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  discord_username TEXT,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE discord_user_links ENABLE ROW LEVEL SECURITY;

-- Users can view their own Discord link (for web UI settings page)
CREATE POLICY "Users can view own discord link"
  ON discord_user_links FOR SELECT
  USING (user_id = auth.uid());

-- Users can delete their own link (unlink Discord)
CREATE POLICY "Users can delete own discord link"
  ON discord_user_links FOR DELETE
  USING (user_id = auth.uid());

-- Only service role (Discord bot) can INSERT/UPDATE — no user policy needed
-- (service role bypasses RLS)

-- ─── Discord User Memory ────────────────────────────────────
-- Persistent memory profiles for Discord users.
-- Uses TEXT primary key (discord_id) instead of UUID since Discord
-- users may not have Supabase accounts.

CREATE TABLE IF NOT EXISTS discord_user_memory (
  discord_id TEXT PRIMARY KEY,
  profile JSONB NOT NULL DEFAULT '{}',
  message_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE discord_user_memory ENABLE ROW LEVEL SECURITY;
-- No policies = only service role (bot) can access

-- ─── Index for conversation lookups ─────────────────────────
-- Speed up finding conversations by Discord channel mapping
CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_discord_user_links_user_id ON discord_user_links(user_id);
