-- Migration 076: User Files & Folders
-- Unified file storage for user-uploaded files and photos.
-- Replaces separate gallery/project file UIs with one system.

-- Folders
CREATE TABLE IF NOT EXISTS user_file_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  parent_id uuid REFERENCES user_file_folders(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_file_folders_user
ON user_file_folders(user_id, sort_order);

ALTER TABLE user_file_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own file folders"
ON user_file_folders FOR ALL USING (auth.uid() = user_id);

-- Files
CREATE TABLE IF NOT EXISTS user_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id uuid REFERENCES user_file_folders(id) ON DELETE SET NULL,
  filename text NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  size_bytes integer NOT NULL DEFAULT 0,
  storage_path text NOT NULL,
  thumbnail_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_files_user
ON user_files(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_files_folder
ON user_files(folder_id);

ALTER TABLE user_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own files"
ON user_files FOR ALL USING (auth.uid() = user_id);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-files', 'user-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: users can only access their own path
CREATE POLICY "Users upload own files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'user-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users read own files"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own files"
ON storage.objects FOR DELETE
USING (bucket_id = 'user-files' AND (storage.foldername(name))[1] = auth.uid()::text);
