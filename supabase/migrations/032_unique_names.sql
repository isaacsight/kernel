-- Migration 032: Unique usernames and display names
--
-- Enforces platform-wide uniqueness for usernames and display names.
-- auth.users.user_metadata can't have constraints, so we use a mirror table
-- with UNIQUE indexes. All profile updates go through the update_user_profile RPC
-- which atomically checks uniqueness and updates both tables.

-- ─── Table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username     TEXT,
  display_name TEXT,
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- Case-insensitive unique indexes (NULLs and empty strings exempt)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_username_lower
  ON user_profiles (lower(trim(username)))
  WHERE username IS NOT NULL AND trim(username) != '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_display_name_lower
  ON user_profiles (lower(trim(display_name)))
  WHERE display_name IS NOT NULL AND trim(display_name) != '';

-- ─── RLS ────────────────────────────────────────────
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read profiles"
  ON user_profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- ─── Backfill from existing auth.users ──────────────
INSERT INTO user_profiles (user_id, username, display_name)
SELECT
  id,
  NULLIF(trim(COALESCE(raw_user_meta_data->>'username', '')), ''),
  NULLIF(trim(COALESCE(
    raw_user_meta_data->>'display_name',
    raw_user_meta_data->>'full_name',
    ''
  )), '')
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- ─── RPC: Check name availability ───────────────────
-- Returns true if the value is available (not taken by another user).
-- Empty/null values always return true.
CREATE OR REPLACE FUNCTION check_name_available(
  p_field TEXT,
  p_value TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_field NOT IN ('username', 'display_name') THEN
    RAISE EXCEPTION 'Invalid field: must be username or display_name';
  END IF;

  IF p_value IS NULL OR trim(p_value) = '' THEN
    RETURN true;
  END IF;

  IF p_field = 'username' THEN
    RETURN NOT EXISTS (
      SELECT 1 FROM user_profiles
      WHERE lower(trim(username)) = lower(trim(p_value))
        AND user_id != auth.uid()
    );
  ELSE
    RETURN NOT EXISTS (
      SELECT 1 FROM user_profiles
      WHERE lower(trim(display_name)) = lower(trim(p_value))
        AND user_id != auth.uid()
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION check_name_available FROM public, anon;
GRANT EXECUTE ON FUNCTION check_name_available TO authenticated;

-- ─── RPC: Update user profile (atomic) ──────────────
-- Checks uniqueness, updates user_profiles, then syncs auth.users.
-- Returns JSONB: { success: true } or { error: 'username_taken' | 'display_name_taken' }
CREATE OR REPLACE FUNCTION update_user_profile(
  p_display_name TEXT DEFAULT NULL,
  p_username     TEXT DEFAULT NULL,
  p_avatar_url   TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      UUID := auth.uid();
  v_display_name TEXT := NULLIF(trim(COALESCE(p_display_name, '')), '');
  v_username     TEXT := NULLIF(trim(COALESCE(p_username, '')), '');
  v_avatar_url   TEXT := COALESCE(p_avatar_url, '');
  v_existing_meta JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  -- Check username uniqueness
  IF v_username IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM user_profiles
      WHERE lower(trim(username)) = lower(v_username)
        AND user_id != v_user_id
    ) THEN
      RETURN jsonb_build_object('error', 'username_taken');
    END IF;
  END IF;

  -- Check display_name uniqueness
  IF v_display_name IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM user_profiles
      WHERE lower(trim(display_name)) = lower(v_display_name)
        AND user_id != v_user_id
    ) THEN
      RETURN jsonb_build_object('error', 'display_name_taken');
    END IF;
  END IF;

  -- Upsert user_profiles
  INSERT INTO user_profiles (user_id, username, display_name, updated_at)
  VALUES (v_user_id, v_username, v_display_name, now())
  ON CONFLICT (user_id) DO UPDATE SET
    username     = EXCLUDED.username,
    display_name = EXCLUDED.display_name,
    updated_at   = now();

  -- Sync auth.users.raw_user_meta_data
  SELECT raw_user_meta_data INTO v_existing_meta
  FROM auth.users WHERE id = v_user_id;

  UPDATE auth.users SET
    raw_user_meta_data = COALESCE(v_existing_meta, '{}'::jsonb)
      || jsonb_build_object(
        'display_name', COALESCE(v_display_name, ''),
        'username', COALESCE(v_username, ''),
        'avatar_url', CASE
          WHEN v_avatar_url != '' THEN v_avatar_url
          ELSE COALESCE(v_existing_meta->>'avatar_url', '')
        END
      ),
    updated_at = now()
  WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION update_user_profile FROM public, anon;
GRANT EXECUTE ON FUNCTION update_user_profile TO authenticated;

-- ─── Trigger: auto-create profile row on signup ─────
-- Best-effort: if display_name conflicts, insert with NULL display_name.
CREATE OR REPLACE FUNCTION handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username     TEXT := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'username', '')), '');
  v_display_name TEXT := NULLIF(trim(COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'full_name',
    ''
  )), '');
BEGIN
  -- Try full insert; on unique violation, retry without the conflicting field
  BEGIN
    INSERT INTO user_profiles (user_id, username, display_name)
    VALUES (NEW.id, v_username, v_display_name)
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION
    WHEN unique_violation THEN
      -- One of the names conflicts — insert with NULLs and let user pick later
      INSERT INTO user_profiles (user_id, username, display_name)
      VALUES (NEW.id, NULL, NULL)
      ON CONFLICT (user_id) DO NOTHING;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_profile();
