-- 024: Trigram indexes for conversation search
-- Enables fast substring matching via .ilike() queries

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_messages_content_trgm ON messages USING gin (content gin_trgm_ops);
CREATE INDEX idx_conversations_title_trgm ON conversations USING gin (title gin_trgm_ops);
