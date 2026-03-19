-- Forge Registry: shared forged tools across all kbot users
-- Collective autopoiesis — each installation contributes tools others can use

CREATE TABLE IF NOT EXISTS forged_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  code TEXT NOT NULL,
  parameters JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  version TEXT DEFAULT '1.0.0',
  downloads INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Unique per author (same user can't publish two tools with the same name)
  UNIQUE(author_id, name)
);

-- Index for search
CREATE INDEX IF NOT EXISTS idx_forged_tools_name ON forged_tools USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_forged_tools_description ON forged_tools USING gin(description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_forged_tools_downloads ON forged_tools(downloads DESC);
CREATE INDEX IF NOT EXISTS idx_forged_tools_tags ON forged_tools USING gin(tags);

-- Enable trigram extension for fuzzy search (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- RPC to atomically increment downloads
CREATE OR REPLACE FUNCTION increment_forge_downloads(tool_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE forged_tools SET downloads = downloads + 1 WHERE id = tool_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS: anyone can read, only authors can write their own
ALTER TABLE forged_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read forged tools"
  ON forged_tools FOR SELECT
  USING (true);

CREATE POLICY "Authors can insert their own tools"
  ON forged_tools FOR INSERT
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update their own tools"
  ON forged_tools FOR UPDATE
  USING (auth.uid() = author_id);

CREATE POLICY "Authors can delete their own tools"
  ON forged_tools FOR DELETE
  USING (auth.uid() = author_id);
