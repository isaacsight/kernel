-- 093: Discord link tokens
-- One-time codes that authorize a Discord user to link a kernel.chat account.
--
-- Closes the link-hijack hole identified in the discord review: previously
-- /link <user_id> accepted any UUID with no ownership proof, so a stranger
-- who knew (or guessed) a user_id could hijack the account. Now the flow is:
--   1. Web user generates a token via the discord-link-code edge function.
--   2. Web user pastes /link code:<token> into Discord.
--   3. Bot looks up the row by token, verifies expiry, links, and deletes
--      the row in one atomic step.
--
-- Tokens are short (8 chars) so they're easy to type. Entropy is 8 * log2(32)
-- = 40 bits — sufficient given the 15-minute TTL and the bot's fail-closed
-- behavior on missing rows.

CREATE TABLE IF NOT EXISTS discord_link_tokens (
  token TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE discord_link_tokens ENABLE ROW LEVEL SECURITY;

-- Users can see their own outstanding tokens (for the settings UI).
CREATE POLICY "Users can view own link tokens"
  ON discord_link_tokens FOR SELECT
  USING (user_id = auth.uid());

-- Users can cancel their own outstanding tokens.
CREATE POLICY "Users can delete own link tokens"
  ON discord_link_tokens FOR DELETE
  USING (user_id = auth.uid());

-- INSERT happens only via the discord-link-code edge function under
-- service-role auth — no user-facing INSERT policy.

CREATE INDEX IF NOT EXISTS idx_discord_link_tokens_user_id ON discord_link_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_discord_link_tokens_expires_at ON discord_link_tokens(expires_at);
