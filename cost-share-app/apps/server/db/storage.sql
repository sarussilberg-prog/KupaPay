-- Supabase Storage setup for group images
-- Run in Supabase SQL Editor after schema.sql

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'group-images',
    'group-images',
    true,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Authenticated users can upload group images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view group images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update group images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete group images" ON storage.objects;

CREATE POLICY "Authenticated users can upload group images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'group-images');

CREATE POLICY "Anyone can view group images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'group-images');

CREATE POLICY "Authenticated users can update group images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'group-images');

CREATE POLICY "Authenticated users can delete group images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'group-images');
