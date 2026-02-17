-- Migration 011: Add attachments column to messages table
-- Stores file metadata (name, type, size) as JSONB for document analysis feature

ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT NULL;

-- Index for querying messages with attachments
CREATE INDEX IF NOT EXISTS idx_messages_attachments ON messages USING gin (attachments) WHERE attachments IS NOT NULL;
