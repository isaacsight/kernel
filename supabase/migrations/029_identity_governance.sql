-- 029: Identity Governance — Trust Recovery State Machine
--
-- Implements: recovery_requests, recovery_tokens, identity_events, device_fingerprints
-- State machine: INITIATED → CHALLENGED → VERIFIED → EXECUTED → (EXPIRED | REVOKED)
-- Token lifecycle: one-time, SHA-256 hashed, time-bound
-- Risk scoring: IP, device, geography, timing anomaly detection

-- ─── pgcrypto for token hashing ─────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── 1. Recovery Requests (State Machine) ───────────
-- Each password reset, email change, or username change is a recovery request
-- that transitions through deterministic states.
CREATE TABLE IF NOT EXISTS recovery_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type  TEXT NOT NULL CHECK (request_type IN ('password_reset', 'email_change', 'username_change')),
  state         TEXT NOT NULL DEFAULT 'initiated' CHECK (state IN (
    'initiated',    -- request created, challenge not yet sent
    'challenged',   -- challenge delivered (email code, etc.)
    'verified',     -- challenge response validated
    'executed',     -- credential change committed
    'expired',      -- TTL exceeded before execution
    'revoked'       -- manually cancelled or superseded
  )),
  -- Trust context captured at initiation
  ip_address    INET,
  user_agent    TEXT,
  device_id     TEXT,           -- fingerprint hash
  geo_country   TEXT,           -- ISO 3166-1 alpha-2
  geo_region    TEXT,
  -- Risk assessment
  risk_score    SMALLINT NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  risk_factors  JSONB NOT NULL DEFAULT '[]'::JSONB,
  trust_tier    TEXT NOT NULL DEFAULT 'standard' CHECK (trust_tier IN ('standard', 'elevated', 'critical')),
  -- Challenge tracking
  challenge_method  TEXT CHECK (challenge_method IN ('email_code', 'email_link', 'totp', 'recovery_code')),
  challenge_sent_at TIMESTAMPTZ,
  challenge_attempts SMALLINT NOT NULL DEFAULT 0,
  max_challenge_attempts SMALLINT NOT NULL DEFAULT 5,
  -- Execution metadata
  old_value     TEXT,           -- previous email/username (encrypted at app layer)
  new_value     TEXT,           -- requested new value (encrypted at app layer)
  executed_at   TIMESTAMPTZ,
  -- Lifecycle
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 minutes'),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient lookup
CREATE INDEX IF NOT EXISTS idx_recovery_requests_user_state ON recovery_requests(user_id, state);
CREATE INDEX IF NOT EXISTS idx_recovery_requests_expires ON recovery_requests(expires_at) WHERE state NOT IN ('executed', 'expired', 'revoked');

-- ─── 2. Recovery Tokens ─────────────────────────────
-- One-time tokens hashed with SHA-256. Raw value never stored.
CREATE TABLE IF NOT EXISTS recovery_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    UUID NOT NULL REFERENCES recovery_requests(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL,         -- SHA-256 of the raw token
  token_type    TEXT NOT NULL CHECK (token_type IN ('challenge', 'execution')),
  used          BOOLEAN NOT NULL DEFAULT false,
  used_at       TIMESTAMPTZ,
  used_ip       INET,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '15 minutes'),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_recovery_tokens_hash ON recovery_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_recovery_tokens_request ON recovery_tokens(request_id);

-- ─── 3. Device Fingerprints ─────────────────────────
-- Known devices per user, trust builds over time.
CREATE TABLE IF NOT EXISTS device_fingerprints (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id     TEXT NOT NULL,         -- client-generated fingerprint hash
  device_name   TEXT,                  -- user-facing label (e.g., "Chrome on MacOS")
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_ip       INET,
  last_country  TEXT,
  is_trusted    BOOLEAN NOT NULL DEFAULT false,
  seen_count    INT NOT NULL DEFAULT 1,
  UNIQUE(user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_device_fingerprints_user ON device_fingerprints(user_id);

-- ─── 4. Identity Events (Immutable Audit) ───────────
-- Append-only ledger of all identity-related actions.
-- Unlike audit_events (general), this is identity-specific with replay visibility.
CREATE TABLE IF NOT EXISTS identity_events (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL CHECK (event_type IN (
    'recovery.initiated', 'recovery.challenged', 'recovery.verified',
    'recovery.executed', 'recovery.expired', 'recovery.revoked',
    'recovery.failed',
    'credential.password_changed', 'credential.email_changed', 'credential.username_changed',
    'session.invalidated', 'session.invalidated_all',
    'device.new_seen', 'device.trusted', 'device.untrusted',
    'risk.escalated', 'risk.anomaly_detected',
    'token.created', 'token.consumed', 'token.expired'
  )),
  request_id    UUID REFERENCES recovery_requests(id) ON DELETE SET NULL,
  ip_address    INET,
  user_agent    TEXT,
  device_id     TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}'::JSONB,
  -- Tamper detection: hash of previous event for this user
  prev_event_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_identity_events_user ON identity_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_identity_events_request ON identity_events(request_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_identity_events_type ON identity_events(event_type, created_at DESC);

-- ─── 5. RPC: Create Recovery Request ────────────────
-- Initiates a recovery flow with risk scoring.
CREATE OR REPLACE FUNCTION create_recovery_request(
  p_user_id       UUID,
  p_request_type  TEXT,
  p_ip_address    INET DEFAULT NULL,
  p_user_agent    TEXT DEFAULT NULL,
  p_device_id     TEXT DEFAULT NULL,
  p_geo_country   TEXT DEFAULT NULL,
  p_geo_region    TEXT DEFAULT NULL,
  p_old_value     TEXT DEFAULT NULL,
  p_new_value     TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_risk_score    SMALLINT := 0;
  v_risk_factors  JSONB := '[]'::JSONB;
  v_trust_tier    TEXT := 'standard';
  v_known_device  BOOLEAN := false;
  v_recent_count  INT;
  v_last_country  TEXT;
  v_ttl           INTERVAL;
  v_max_attempts  SMALLINT;
  v_request_id    UUID;
BEGIN
  -- Revoke any pending requests of the same type (supersede)
  UPDATE recovery_requests
  SET state = 'revoked', updated_at = now()
  WHERE user_id = p_user_id
    AND request_type = p_request_type
    AND state IN ('initiated', 'challenged', 'verified');

  -- ── Risk Factor 1: Known device? ──────────────────
  SELECT true INTO v_known_device
  FROM device_fingerprints
  WHERE user_id = p_user_id AND device_id = p_device_id AND is_trusted = true;

  IF NOT v_known_device OR v_known_device IS NULL THEN
    v_risk_score := v_risk_score + 15;
    v_risk_factors := v_risk_factors || '["unknown_device"]'::JSONB;
  END IF;

  -- ── Risk Factor 2: Recent failed attempts ─────────
  SELECT COUNT(*) INTO v_recent_count
  FROM identity_events
  WHERE user_id = p_user_id
    AND event_type = 'recovery.failed'
    AND created_at > now() - INTERVAL '1 hour';

  IF v_recent_count >= 3 THEN
    v_risk_score := v_risk_score + 25;
    v_risk_factors := v_risk_factors || '["recent_failures"]'::JSONB;
  ELSIF v_recent_count >= 1 THEN
    v_risk_score := v_risk_score + 10;
    v_risk_factors := v_risk_factors || '["some_failures"]'::JSONB;
  END IF;

  -- ── Risk Factor 3: Geography anomaly ──────────────
  SELECT last_country INTO v_last_country
  FROM device_fingerprints
  WHERE user_id = p_user_id AND is_trusted = true
  ORDER BY last_seen_at DESC
  LIMIT 1;

  IF v_last_country IS NOT NULL AND p_geo_country IS NOT NULL AND v_last_country != p_geo_country THEN
    v_risk_score := v_risk_score + 20;
    v_risk_factors := v_risk_factors || jsonb_build_array('geo_mismatch:' || v_last_country || '->' || p_geo_country);
  END IF;

  -- ── Risk Factor 4: Request frequency ──────────────
  SELECT COUNT(*) INTO v_recent_count
  FROM recovery_requests
  WHERE user_id = p_user_id
    AND created_at > now() - INTERVAL '24 hours';

  IF v_recent_count >= 5 THEN
    v_risk_score := v_risk_score + 30;
    v_risk_factors := v_risk_factors || '["high_frequency"]'::JSONB;
  ELSIF v_recent_count >= 2 THEN
    v_risk_score := v_risk_score + 10;
    v_risk_factors := v_risk_factors || '["elevated_frequency"]'::JSONB;
  END IF;

  -- ── Determine trust tier ──────────────────────────
  IF v_risk_score >= 50 THEN
    v_trust_tier := 'critical';
    v_ttl := INTERVAL '10 minutes';
    v_max_attempts := 3;
  ELSIF v_risk_score >= 25 THEN
    v_trust_tier := 'elevated';
    v_ttl := INTERVAL '20 minutes';
    v_max_attempts := 4;
  ELSE
    v_trust_tier := 'standard';
    v_ttl := INTERVAL '30 minutes';
    v_max_attempts := 5;
  END IF;

  -- ── Insert request ────────────────────────────────
  INSERT INTO recovery_requests (
    user_id, request_type, ip_address, user_agent, device_id,
    geo_country, geo_region, risk_score, risk_factors, trust_tier,
    max_challenge_attempts, old_value, new_value, expires_at
  ) VALUES (
    p_user_id, p_request_type, p_ip_address, p_user_agent, p_device_id,
    p_geo_country, p_geo_region, v_risk_score, v_risk_factors, v_trust_tier,
    v_max_attempts, p_old_value, p_new_value, now() + v_ttl
  )
  RETURNING id INTO v_request_id;

  -- ── Log identity event ────────────────────────────
  INSERT INTO identity_events (user_id, event_type, request_id, ip_address, user_agent, device_id, metadata)
  VALUES (
    p_user_id, 'recovery.initiated', v_request_id, p_ip_address, p_user_agent, p_device_id,
    jsonb_build_object(
      'request_type', p_request_type,
      'risk_score', v_risk_score,
      'trust_tier', v_trust_tier,
      'risk_factors', v_risk_factors
    )
  );

  RETURN jsonb_build_object(
    'request_id', v_request_id,
    'risk_score', v_risk_score,
    'trust_tier', v_trust_tier,
    'expires_at', now() + v_ttl,
    'max_attempts', v_max_attempts
  );
END;
$$;

-- ─── 6. RPC: Record Challenge Sent ──────────────────
CREATE OR REPLACE FUNCTION record_challenge_sent(
  p_request_id     UUID,
  p_method         TEXT,
  p_token_hash     TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update request state
  UPDATE recovery_requests
  SET state = 'challenged',
      challenge_method = p_method,
      challenge_sent_at = now(),
      updated_at = now()
  WHERE id = p_request_id
    AND state = 'initiated'
    AND expires_at > now();

  IF NOT FOUND THEN RETURN false; END IF;

  -- Create hashed token record
  INSERT INTO recovery_tokens (request_id, token_hash, token_type, expires_at)
  VALUES (p_request_id, p_token_hash, 'challenge', now() + INTERVAL '15 minutes');

  RETURN true;
END;
$$;

-- ─── 7. RPC: Verify Challenge Response ──────────────
-- Validates the token hash, marks used, transitions state.
CREATE OR REPLACE FUNCTION verify_challenge(
  p_request_id  UUID,
  p_token_hash  TEXT,
  p_ip_address  INET DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request     recovery_requests%ROWTYPE;
  v_token       recovery_tokens%ROWTYPE;
BEGIN
  -- Fetch and lock the request
  SELECT * INTO v_request
  FROM recovery_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'request_not_found');
  END IF;

  -- Check state
  IF v_request.state != 'challenged' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_state');
  END IF;

  -- Check expiry
  IF v_request.expires_at <= now() THEN
    UPDATE recovery_requests SET state = 'expired', updated_at = now() WHERE id = p_request_id;
    INSERT INTO identity_events (user_id, event_type, request_id, ip_address, metadata)
    VALUES (v_request.user_id, 'recovery.expired', p_request_id, p_ip_address, '{}'::JSONB);
    RETURN jsonb_build_object('success', false, 'error', 'expired');
  END IF;

  -- Check attempts
  IF v_request.challenge_attempts >= v_request.max_challenge_attempts THEN
    UPDATE recovery_requests SET state = 'revoked', updated_at = now() WHERE id = p_request_id;
    INSERT INTO identity_events (user_id, event_type, request_id, ip_address, metadata)
    VALUES (v_request.user_id, 'recovery.failed', p_request_id, p_ip_address,
      jsonb_build_object('reason', 'max_attempts_exceeded'));
    RETURN jsonb_build_object('success', false, 'error', 'max_attempts');
  END IF;

  -- Increment attempt counter
  UPDATE recovery_requests
  SET challenge_attempts = challenge_attempts + 1, updated_at = now()
  WHERE id = p_request_id;

  -- Find matching unused token
  SELECT * INTO v_token
  FROM recovery_tokens
  WHERE request_id = p_request_id
    AND token_hash = p_token_hash
    AND token_type = 'challenge'
    AND used = false
    AND expires_at > now();

  IF NOT FOUND THEN
    INSERT INTO identity_events (user_id, event_type, request_id, ip_address, metadata)
    VALUES (v_request.user_id, 'recovery.failed', p_request_id, p_ip_address,
      jsonb_build_object('reason', 'invalid_token', 'attempt', v_request.challenge_attempts + 1));
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;

  -- Consume the token
  UPDATE recovery_tokens
  SET used = true, used_at = now(), used_ip = p_ip_address
  WHERE id = v_token.id;

  -- Transition to verified
  UPDATE recovery_requests
  SET state = 'verified', updated_at = now()
  WHERE id = p_request_id;

  -- Log
  INSERT INTO identity_events (user_id, event_type, request_id, ip_address, metadata)
  VALUES (v_request.user_id, 'recovery.verified', p_request_id, p_ip_address,
    jsonb_build_object('challenge_method', v_request.challenge_method));

  INSERT INTO identity_events (user_id, event_type, request_id, metadata)
  VALUES (v_request.user_id, 'token.consumed', p_request_id,
    jsonb_build_object('token_type', 'challenge'));

  RETURN jsonb_build_object('success', true, 'state', 'verified');
END;
$$;

-- ─── 8. RPC: Execute Recovery ───────────────────────
-- Final state transition. Caller (edge function) must perform the actual credential change.
CREATE OR REPLACE FUNCTION execute_recovery(
  p_request_id  UUID,
  p_ip_address  INET DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request recovery_requests%ROWTYPE;
  v_event_type TEXT;
BEGIN
  SELECT * INTO v_request
  FROM recovery_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'request_not_found');
  END IF;

  IF v_request.state != 'verified' THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_verified');
  END IF;

  IF v_request.expires_at <= now() THEN
    UPDATE recovery_requests SET state = 'expired', updated_at = now() WHERE id = p_request_id;
    RETURN jsonb_build_object('success', false, 'error', 'expired');
  END IF;

  -- Transition to executed
  UPDATE recovery_requests
  SET state = 'executed', executed_at = now(), updated_at = now()
  WHERE id = p_request_id;

  -- Determine credential event type
  v_event_type := CASE v_request.request_type
    WHEN 'password_reset' THEN 'credential.password_changed'
    WHEN 'email_change' THEN 'credential.email_changed'
    WHEN 'username_change' THEN 'credential.username_changed'
  END;

  -- Log both recovery execution and credential change
  INSERT INTO identity_events (user_id, event_type, request_id, ip_address, metadata)
  VALUES
    (v_request.user_id, 'recovery.executed', p_request_id, p_ip_address,
      jsonb_build_object('request_type', v_request.request_type, 'trust_tier', v_request.trust_tier)),
    (v_request.user_id, v_event_type, p_request_id, p_ip_address,
      jsonb_build_object('risk_score', v_request.risk_score));

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_request.user_id,
    'request_type', v_request.request_type,
    'trust_tier', v_request.trust_tier
  );
END;
$$;

-- ─── 9. RPC: Touch Device ───────────────────────────
-- Upserts device fingerprint, returns whether it's known.
CREATE OR REPLACE FUNCTION touch_device(
  p_user_id     UUID,
  p_device_id   TEXT,
  p_device_name TEXT DEFAULT NULL,
  p_ip_address  INET DEFAULT NULL,
  p_country     TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_new BOOLEAN := false;
  v_is_trusted BOOLEAN := false;
BEGIN
  INSERT INTO device_fingerprints (user_id, device_id, device_name, last_ip, last_country)
  VALUES (p_user_id, p_device_id, p_device_name, p_ip_address, p_country)
  ON CONFLICT (user_id, device_id) DO UPDATE
  SET last_seen_at = now(),
      last_ip = COALESCE(p_ip_address, device_fingerprints.last_ip),
      last_country = COALESCE(p_country, device_fingerprints.last_country),
      device_name = COALESCE(p_device_name, device_fingerprints.device_name),
      seen_count = device_fingerprints.seen_count + 1
  RETURNING (xmax = 0), is_trusted INTO v_is_new, v_is_trusted;

  -- Log new device
  IF v_is_new THEN
    INSERT INTO identity_events (user_id, event_type, device_id, ip_address, metadata)
    VALUES (p_user_id, 'device.new_seen', p_device_id, p_ip_address,
      jsonb_build_object('device_name', p_device_name, 'country', p_country));
  END IF;

  RETURN jsonb_build_object(
    'is_new', v_is_new,
    'is_trusted', v_is_trusted
  );
END;
$$;

-- ─── 10. RPC: Expire Stale Requests ─────────────────
-- Called by task-scheduler cron to clean up expired recovery flows.
CREATE OR REPLACE FUNCTION expire_stale_recovery_requests()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  WITH expired AS (
    UPDATE recovery_requests
    SET state = 'expired', updated_at = now()
    WHERE state IN ('initiated', 'challenged', 'verified')
      AND expires_at <= now()
    RETURNING id, user_id
  )
  SELECT COUNT(*) INTO v_count FROM expired;

  -- Also expire unused tokens
  UPDATE recovery_tokens
  SET used = true, used_at = now()
  WHERE used = false AND expires_at <= now();

  RETURN v_count;
END;
$$;

-- ─── 11. RPC: Get Identity Audit Trail ──────────────
-- Returns paginated identity events for a user (replay visibility).
CREATE OR REPLACE FUNCTION get_identity_events(
  p_user_id UUID,
  p_limit   INT DEFAULT 50,
  p_offset  INT DEFAULT 0
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_events JSONB;
  v_total  INT;
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM identity_events
  WHERE user_id = p_user_id;

  SELECT COALESCE(jsonb_agg(row_to_json(e)::JSONB ORDER BY e.created_at DESC), '[]'::JSONB)
  INTO v_events
  FROM (
    SELECT id, created_at, event_type, request_id, ip_address, device_id, metadata
    FROM identity_events
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) e;

  RETURN jsonb_build_object(
    'events', v_events,
    'total', v_total,
    'limit', p_limit,
    'offset', p_offset
  );
END;
$$;

-- ─── 12. Security: Revoke public access to RPCs ─────
REVOKE ALL ON FUNCTION create_recovery_request FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION record_challenge_sent FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION verify_challenge FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION execute_recovery FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION touch_device FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION expire_stale_recovery_requests FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION get_identity_events FROM public, anon, authenticated;

-- ─── 13. RLS Policies ───────────────────────────────
ALTER TABLE recovery_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_events ENABLE ROW LEVEL SECURITY;

-- No direct client access — all via service-role RPCs
-- Users can read their own device fingerprints (for settings UI)
CREATE POLICY "Users can view own devices" ON device_fingerprints
  FOR SELECT USING (auth.uid() = user_id);

-- All other tables: service-role only (no client policies)
