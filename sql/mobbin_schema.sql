-- Mobbin Data Schema for Postgres / Supabase
-- Apps table
CREATE TABLE IF NOT EXISTS mobbin_apps (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tagline TEXT,
    platform TEXT DEFAULT 'iOS',
    categories TEXT [],
    -- Array of strings
    tags TEXT [],
    popularity_score FLOAT DEFAULT 0,
    rating FLOAT,
    url TEXT,
    logo_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
-- Flows table
CREATE TABLE IF NOT EXISTS mobbin_flows (
    id TEXT PRIMARY KEY,
    app_id TEXT REFERENCES mobbin_apps(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    url TEXT,
    screen_ids TEXT [],
    -- Ordered list of screen IDs in this flow
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
-- Screens table
CREATE TABLE IF NOT EXISTS mobbin_screens (
    id TEXT PRIMARY KEY,
    app_id TEXT REFERENCES mobbin_apps(id) ON DELETE CASCADE,
    flow_id TEXT REFERENCES mobbin_flows(id) ON DELETE
    SET NULL,
        title TEXT,
        image_url TEXT,
        local_path TEXT,
        tags TEXT [],
        text_content TEXT,
        -- Extracted text / summary
        embedding vector(1536),
        -- For local semantic search (if pgvector is available)
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
-- Indices for faster search
CREATE INDEX IF NOT EXISTS idx_mobbin_apps_name ON mobbin_apps(name);
CREATE INDEX IF NOT EXISTS idx_mobbin_screens_app_id ON mobbin_screens(app_id);
CREATE INDEX IF NOT EXISTS idx_mobbin_flows_app_id ON mobbin_flows(app_id);