-- Buddy Leaderboard — anonymous cross-install rankings for kbot buddies
--
-- Each kbot install syncs its buddy stats (species, level, XP, achievements, sessions)
-- using a SHA-256 hash of hostname+homedir as device_hash (fully anonymous).
-- The leaderboard is public (no auth required to read).

CREATE TABLE IF NOT EXISTS buddy_leaderboard (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_hash TEXT UNIQUE NOT NULL,
  species TEXT NOT NULL,
  level INTEGER DEFAULT 0,
  xp INTEGER DEFAULT 0,
  achievement_count INTEGER DEFAULT 0,
  sessions INTEGER DEFAULT 0,
  last_synced TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_buddy_leaderboard_xp ON buddy_leaderboard(xp DESC);
CREATE INDEX idx_buddy_leaderboard_species ON buddy_leaderboard(species, xp DESC);

-- RPC for upserting buddy data (called from kbot-engine edge function)
CREATE OR REPLACE FUNCTION upsert_buddy_entry(
  p_device_hash TEXT,
  p_species TEXT,
  p_level INTEGER,
  p_xp INTEGER,
  p_achievement_count INTEGER,
  p_sessions INTEGER
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO buddy_leaderboard (device_hash, species, level, xp, achievement_count, sessions)
  VALUES (p_device_hash, p_species, p_level, p_xp, p_achievement_count, p_sessions)
  ON CONFLICT (device_hash) DO UPDATE SET
    species = EXCLUDED.species,
    level = EXCLUDED.level,
    xp = EXCLUDED.xp,
    achievement_count = EXCLUDED.achievement_count,
    sessions = EXCLUDED.sessions,
    last_synced = now();
END;
$$;

-- RPC for reading leaderboard (public, no auth)
CREATE OR REPLACE FUNCTION get_buddy_leaderboard(p_limit INTEGER DEFAULT 50)
RETURNS TABLE(species TEXT, level INTEGER, xp INTEGER, achievement_count INTEGER, sessions INTEGER, rank BIGINT)
LANGUAGE sql STABLE AS $$
  SELECT bl.species, bl.level, bl.xp, bl.achievement_count, bl.sessions,
    ROW_NUMBER() OVER (ORDER BY bl.xp DESC) as rank
  FROM buddy_leaderboard bl
  ORDER BY bl.xp DESC
  LIMIT p_limit;
$$;

-- RPC for reading leaderboard filtered by species
CREATE OR REPLACE FUNCTION get_buddy_leaderboard_by_species(p_species TEXT, p_limit INTEGER DEFAULT 50)
RETURNS TABLE(species TEXT, level INTEGER, xp INTEGER, achievement_count INTEGER, sessions INTEGER, rank BIGINT)
LANGUAGE sql STABLE AS $$
  SELECT bl.species, bl.level, bl.xp, bl.achievement_count, bl.sessions,
    ROW_NUMBER() OVER (ORDER BY bl.xp DESC) as rank
  FROM buddy_leaderboard bl
  WHERE bl.species = p_species
  ORDER BY bl.xp DESC
  LIMIT p_limit;
$$;

-- RLS: public read, service-role write
ALTER TABLE buddy_leaderboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "buddy_leaderboard_public_read"
  ON buddy_leaderboard FOR SELECT
  USING (true);

CREATE POLICY "buddy_leaderboard_service_write"
  ON buddy_leaderboard FOR ALL
  USING (auth.role() = 'service_role');
