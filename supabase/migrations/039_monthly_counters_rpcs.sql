-- 039: Monthly counter RPCs for 3-tier subscription system
-- 30-day rolling window, matching daily counter patterns from migrations 027/030/035

-- ─── Monthly Message Limit ─────────────────────────────────────

-- Read-only check: returns {allowed, monthly_count, resets_at}
CREATE OR REPLACE FUNCTION check_monthly_message_limit(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
  v_window_start TIMESTAMPTZ;
  v_window_end TIMESTAMPTZ;
BEGIN
  SELECT monthly_message_count, monthly_window_start
  INTO v_count, v_window_start
  FROM user_memory
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('monthly_count', 0, 'resets_at', NULL);
  END IF;

  -- Window expired or never started → count is effectively 0
  IF v_window_start IS NULL OR (NOW() - v_window_start) > INTERVAL '30 days' THEN
    RETURN jsonb_build_object('monthly_count', 0, 'resets_at', NULL);
  END IF;

  v_window_end := v_window_start + INTERVAL '30 days';
  RETURN jsonb_build_object('monthly_count', COALESCE(v_count, 0), 'resets_at', v_window_end);
END;
$$;

-- Atomic increment with auto-reset on window expiry
CREATE OR REPLACE FUNCTION increment_monthly_message_count(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
  v_window_start TIMESTAMPTZ;
BEGIN
  -- Ensure row exists
  INSERT INTO user_memory (user_id) VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Reset window if expired or never started
  UPDATE user_memory
  SET monthly_message_count = 0, monthly_window_start = NOW()
  WHERE user_id = p_user_id
    AND (monthly_window_start IS NULL OR (NOW() - monthly_window_start) > INTERVAL '30 days');

  -- Atomic increment
  UPDATE user_memory
  SET monthly_message_count = monthly_message_count + 1
  WHERE user_id = p_user_id
  RETURNING monthly_message_count, monthly_window_start
  INTO v_count, v_window_start;

  RETURN jsonb_build_object(
    'monthly_count', v_count,
    'resets_at', v_window_start + INTERVAL '30 days'
  );
END;
$$;

-- ─── Monthly Extended Thinking Limit ───────────────────────────

CREATE OR REPLACE FUNCTION check_monthly_et_limit(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
  v_window_start TIMESTAMPTZ;
BEGIN
  SELECT monthly_et_count, monthly_window_start
  INTO v_count, v_window_start
  FROM user_memory
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('monthly_count', 0, 'resets_at', NULL);
  END IF;

  IF v_window_start IS NULL OR (NOW() - v_window_start) > INTERVAL '30 days' THEN
    RETURN jsonb_build_object('monthly_count', 0, 'resets_at', NULL);
  END IF;

  RETURN jsonb_build_object('monthly_count', COALESCE(v_count, 0), 'resets_at', v_window_start + INTERVAL '30 days');
END;
$$;

CREATE OR REPLACE FUNCTION increment_monthly_et_count(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
  v_window_start TIMESTAMPTZ;
BEGIN
  INSERT INTO user_memory (user_id) VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE user_memory
  SET monthly_et_count = 0, monthly_window_start = NOW()
  WHERE user_id = p_user_id
    AND (monthly_window_start IS NULL OR (NOW() - monthly_window_start) > INTERVAL '30 days');

  UPDATE user_memory
  SET monthly_et_count = monthly_et_count + 1
  WHERE user_id = p_user_id
  RETURNING monthly_et_count, monthly_window_start
  INTO v_count, v_window_start;

  RETURN jsonb_build_object(
    'monthly_count', v_count,
    'resets_at', v_window_start + INTERVAL '30 days'
  );
END;
$$;

-- ─── Monthly File Limit ────────────────────────────────────────

CREATE OR REPLACE FUNCTION check_monthly_file_limit(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
  v_window_start TIMESTAMPTZ;
BEGIN
  SELECT monthly_file_count, monthly_window_start
  INTO v_count, v_window_start
  FROM user_memory
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('monthly_count', 0, 'resets_at', NULL);
  END IF;

  IF v_window_start IS NULL OR (NOW() - v_window_start) > INTERVAL '30 days' THEN
    RETURN jsonb_build_object('monthly_count', 0, 'resets_at', NULL);
  END IF;

  RETURN jsonb_build_object('monthly_count', COALESCE(v_count, 0), 'resets_at', v_window_start + INTERVAL '30 days');
END;
$$;

CREATE OR REPLACE FUNCTION increment_monthly_file_count(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
  v_window_start TIMESTAMPTZ;
BEGIN
  INSERT INTO user_memory (user_id) VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE user_memory
  SET monthly_file_count = 0, monthly_window_start = NOW()
  WHERE user_id = p_user_id
    AND (monthly_window_start IS NULL OR (NOW() - monthly_window_start) > INTERVAL '30 days');

  UPDATE user_memory
  SET monthly_file_count = monthly_file_count + 1
  WHERE user_id = p_user_id
  RETURNING monthly_file_count, monthly_window_start
  INTO v_count, v_window_start;

  RETURN jsonb_build_object(
    'monthly_count', v_count,
    'resets_at', v_window_start + INTERVAL '30 days'
  );
END;
$$;

-- ─── Security: Revoke direct execution from public roles ──────

REVOKE EXECUTE ON FUNCTION check_monthly_message_limit(UUID) FROM public, authenticated, anon;
REVOKE EXECUTE ON FUNCTION increment_monthly_message_count(UUID) FROM public, authenticated, anon;
REVOKE EXECUTE ON FUNCTION check_monthly_et_limit(UUID) FROM public, authenticated, anon;
REVOKE EXECUTE ON FUNCTION increment_monthly_et_count(UUID) FROM public, authenticated, anon;
REVOKE EXECUTE ON FUNCTION check_monthly_file_limit(UUID) FROM public, authenticated, anon;
REVOKE EXECUTE ON FUNCTION increment_monthly_file_count(UUID) FROM public, authenticated, anon;
