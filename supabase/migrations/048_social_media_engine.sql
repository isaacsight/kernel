-- ─── 048: Social Media Engine ───────────────────────────────────
--
-- Tables for social media account management, post publishing,
-- analytics tracking, and OAuth state management.

-- ─── Enable pgcrypto if not already ────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Token Encryption Functions ────────────────────────────────
-- SECURITY DEFINER: only service_role can call these.

CREATE OR REPLACE FUNCTION encrypt_social_token(token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  key text;
BEGIN
  key := current_setting('app.social_encryption_key', true);
  IF key IS NULL OR key = '' THEN
    RAISE EXCEPTION 'Social encryption key not configured';
  END IF;
  RETURN encode(
    encrypt(
      convert_to(token, 'utf8'),
      convert_to(key, 'utf8'),
      'aes-cbc/pad:pkcs'
    ),
    'base64'
  );
END;
$$;

CREATE OR REPLACE FUNCTION decrypt_social_token(encrypted text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  key text;
BEGIN
  key := current_setting('app.social_encryption_key', true);
  IF key IS NULL OR key = '' THEN
    RAISE EXCEPTION 'Social encryption key not configured';
  END IF;
  RETURN convert_from(
    decrypt(
      decode(encrypted, 'base64'),
      convert_to(key, 'utf8'),
      'aes-cbc/pad:pkcs'
    ),
    'utf8'
  );
END;
$$;

REVOKE ALL ON FUNCTION encrypt_social_token(text) FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION encrypt_social_token(text) TO service_role;

REVOKE ALL ON FUNCTION decrypt_social_token(text) FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION decrypt_social_token(text) TO service_role;

-- ─── Social Accounts ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS social_accounts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform              text NOT NULL CHECK (platform IN ('twitter', 'linkedin', 'instagram', 'threads', 'bluesky', 'mastodon')),
  platform_user_id      text NOT NULL,
  platform_username     text,
  platform_display_name text,
  platform_avatar_url   text,
  access_token_enc      text NOT NULL,
  refresh_token_enc     text,
  token_expires_at      timestamptz,
  scopes                text[] DEFAULT '{}',
  is_active             boolean NOT NULL DEFAULT true,
  connected_at          timestamptz NOT NULL DEFAULT now(),
  last_used_at          timestamptz,
  UNIQUE(user_id, platform, platform_user_id)
);

CREATE INDEX idx_social_accounts_user ON social_accounts(user_id);
CREATE INDEX idx_social_accounts_platform ON social_accounts(platform);

ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY social_accounts_select ON social_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY social_accounts_insert ON social_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY social_accounts_update ON social_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY social_accounts_delete ON social_accounts FOR DELETE USING (auth.uid() = user_id);

-- ─── Social Posts ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS social_posts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id        uuid REFERENCES content_items(id) ON DELETE SET NULL,
  account_id        uuid NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  platform          text NOT NULL,
  body              text NOT NULL,
  media_urls        text[] DEFAULT '{}',
  thread_parts      jsonb,
  hashtags          text[] DEFAULT '{}',
  status            text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled')),
  scheduled_at      timestamptz,
  published_at      timestamptz,
  platform_post_id  text,
  platform_url      text,
  publish_error     text,
  retry_count       integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_social_posts_user ON social_posts(user_id);
CREATE INDEX idx_social_posts_account ON social_posts(account_id);
CREATE INDEX idx_social_posts_content ON social_posts(content_id) WHERE content_id IS NOT NULL;
CREATE INDEX idx_social_posts_scheduled ON social_posts(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX idx_social_posts_status ON social_posts(status);

ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY social_posts_select ON social_posts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY social_posts_insert ON social_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY social_posts_update ON social_posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY social_posts_delete ON social_posts FOR DELETE USING (auth.uid() = user_id);

-- ─── Social Analytics ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS social_analytics (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id           uuid NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform          text NOT NULL,
  impressions       integer DEFAULT 0,
  likes             integer DEFAULT 0,
  reposts           integer DEFAULT 0,
  replies           integer DEFAULT 0,
  clicks            integer DEFAULT 0,
  saves             integer DEFAULT 0,
  reach             integer DEFAULT 0,
  engagement_rate   real DEFAULT 0,
  followers_at_post integer DEFAULT 0,
  follower_delta    integer DEFAULT 0,
  collected_at      timestamptz NOT NULL DEFAULT now(),
  metadata          jsonb DEFAULT '{}',
  UNIQUE(post_id, collected_at)
);

CREATE INDEX idx_social_analytics_post ON social_analytics(post_id);
CREATE INDEX idx_social_analytics_user ON social_analytics(user_id);

ALTER TABLE social_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY social_analytics_select ON social_analytics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY social_analytics_insert ON social_analytics FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ─── OAuth States (temporary, TTL 10 min) ─────────────────────

CREATE TABLE IF NOT EXISTS social_oauth_states (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform      text NOT NULL,
  state         text NOT NULL UNIQUE,
  code_verifier text,
  redirect_uri  text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_social_oauth_states_state ON social_oauth_states(state);
CREATE INDEX idx_social_oauth_states_created ON social_oauth_states(created_at);

ALTER TABLE social_oauth_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY social_oauth_states_select ON social_oauth_states FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY social_oauth_states_insert ON social_oauth_states FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY social_oauth_states_delete ON social_oauth_states FOR DELETE USING (auth.uid() = user_id);
