-- Add username and avatar_url to profiles
ALTER TABLE profiles
  ADD COLUMN username text,
  ADD COLUMN avatar_url text;

-- Case-insensitive unique index (NULLs are not considered duplicates)
CREATE UNIQUE INDEX profiles_username_lower_idx ON profiles (lower(username));

-- Avatars storage bucket (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: anyone can read avatars (bucket is public, but explicit policy is best practice)
CREATE POLICY "avatars_public_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- RLS: authenticated users can upload their own avatar
CREATE POLICY "avatars_owner_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND name LIKE auth.uid()::text || '.%');

-- RLS: authenticated users can replace their own avatar
CREATE POLICY "avatars_owner_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars' AND name LIKE auth.uid()::text || '.%');

-- RLS: authenticated users can delete their own avatar
CREATE POLICY "avatars_owner_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars' AND name LIKE auth.uid()::text || '.%');
