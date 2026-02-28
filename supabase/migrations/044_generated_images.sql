-- 044: Persist generated images to Supabase Storage
-- Tracks metadata for images uploaded to the generated-images bucket.

CREATE TABLE IF NOT EXISTS generated_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id TEXT,
  prompt TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT DEFAULT 'image/png',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_generated_images_user ON generated_images(user_id);
CREATE INDEX idx_generated_images_message ON generated_images(message_id);

ALTER TABLE generated_images ENABLE ROW LEVEL SECURITY;

-- Users can only read their own images
CREATE POLICY "Users read own images"
  ON generated_images FOR SELECT
  USING (auth.uid() = user_id);

-- No public INSERT policy — edge function uses service role
