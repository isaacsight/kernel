-- Add metadata column to conversations for tracking import source
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Example metadata for imported conversations:
-- { "source": "chatgpt", "original_title": "Original conversation title" }
