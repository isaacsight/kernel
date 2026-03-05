-- 064: Public API — api_keys table, validation RPCs, usage_logs api_key_id column
--
-- Stores hashed API keys for B2B developer access to the Kernel agent system.
-- Keys are never stored in plaintext — only SHA-256 hashes + display prefixes.

-- ── Table: api_keys ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL DEFAULT 'Default',
  key_prefix            TEXT NOT NULL,          -- "kn_live_abc12345" (first 20 chars, display only)
  key_hash              TEXT NOT NULL UNIQUE,    -- SHA-256 of full key
  tier                  TEXT NOT NULL DEFAULT 'starter'
                        CHECK (tier IN ('starter', 'growth', 'enterprise')),
  status                TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'revoked', 'expired')),
  -- Per-key limits (set by tier, overridable for enterprise)
  monthly_message_limit INT NOT NULL DEFAULT 5000,
  rate_limit_per_min    INT NOT NULL DEFAULT 60,
  -- Feature flags
  swarm_enabled         BOOLEAN NOT NULL DEFAULT false,
  all_agents_enabled    BOOLEAN NOT NULL DEFAULT false,
  streaming_enabled     BOOLEAN NOT NULL DEFAULT true,
  -- Metering (30-day rolling window)
  monthly_message_count INT NOT NULL DEFAULT 0,
  monthly_window_start  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Lifecycle
  last_used_at          TIMESTAMPTZ,
  revoked_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Stripe (nullable until subscribed)
  stripe_subscription_id TEXT,
  stripe_item_id         TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys (user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys (key_hash) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_api_keys_stripe_sub ON api_keys (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

-- RLS: users can only read their own keys
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own API keys"
  ON api_keys FOR SELECT
  USING (auth.uid() = user_id);

-- All writes go through SECURITY DEFINER RPCs — no insert/update/delete policies for authenticated


-- ── Add api_key_id to usage_logs for per-key cost attribution ───
ALTER TABLE usage_logs ADD COLUMN IF NOT EXISTS api_key_id UUID REFERENCES api_keys(id);
-- Note: usage_logs.feature column already added in migration 055

CREATE INDEX IF NOT EXISTS idx_usage_logs_api_key ON usage_logs (api_key_id, created_at DESC)
  WHERE api_key_id IS NOT NULL;


-- ── RPC: validate_api_key ───────────────────────────────────────
-- Returns key metadata if valid, checks monthly limit, auto-resets 30-day window.
-- Returns NULL row if not found or revoked.
CREATE OR REPLACE FUNCTION validate_api_key(p_key_hash TEXT)
RETURNS TABLE (
  key_id              UUID,
  key_user_id         UUID,
  key_name            TEXT,
  key_tier            TEXT,
  monthly_message_limit INT,
  rate_limit_per_min  INT,
  swarm_enabled       BOOLEAN,
  all_agents_enabled  BOOLEAN,
  streaming_enabled   BOOLEAN,
  monthly_message_count INT,
  monthly_window_start TIMESTAMPTZ,
  monthly_limit_exceeded BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec api_keys%ROWTYPE;
BEGIN
  SELECT * INTO rec
    FROM api_keys ak
   WHERE ak.key_hash = p_key_hash
     AND ak.status = 'active';

  IF NOT FOUND THEN
    RETURN;  -- returns empty result set
  END IF;

  -- Auto-reset 30-day window if expired, and update last_used_at (single UPDATE)
  IF rec.monthly_window_start + INTERVAL '30 days' < now() THEN
    UPDATE api_keys
       SET monthly_message_count = 0,
           monthly_window_start = now(),
           last_used_at = now()
     WHERE api_keys.id = rec.id;
    rec.monthly_message_count := 0;
    rec.monthly_window_start := now();
  ELSE
    UPDATE api_keys SET last_used_at = now() WHERE api_keys.id = rec.id;
  END IF;

  RETURN QUERY SELECT
    rec.id,
    rec.user_id,
    rec.name,
    rec.tier,
    rec.monthly_message_limit,
    rec.rate_limit_per_min,
    rec.swarm_enabled,
    rec.all_agents_enabled,
    rec.streaming_enabled,
    rec.monthly_message_count,
    rec.monthly_window_start,
    (rec.monthly_message_count >= rec.monthly_message_limit) AS monthly_limit_exceeded;
END;
$$;

-- Revoke public access to the function
REVOKE ALL ON FUNCTION validate_api_key(TEXT) FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION validate_api_key(TEXT) TO service_role;


-- ── RPC: increment_api_message_count ────────────────────────────
-- Atomic counter increment for API message metering.
CREATE OR REPLACE FUNCTION increment_api_message_count(p_key_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE api_keys
     SET monthly_message_count = monthly_message_count + 1
   WHERE id = p_key_id
     AND status = 'active';
END;
$$;

REVOKE ALL ON FUNCTION increment_api_message_count(UUID) FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION increment_api_message_count(UUID) TO service_role;
