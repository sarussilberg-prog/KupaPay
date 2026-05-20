-- Idempotent: public group-images storage bucket for group avatars

INSERT INTO storage.buckets (id, name, public)
VALUES ('group-images', 'group-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Group images are publicly readable" ON storage.objects;
CREATE POLICY "Group images are publicly readable"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'group-images');

DROP POLICY IF EXISTS "Group members can upload group images" ON storage.objects;
CREATE POLICY "Group members can upload group images"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'group-images'
        AND public.is_group_member(((storage.foldername(name))[1])::uuid)
    );

DROP POLICY IF EXISTS "Group members can update group images" ON storage.objects;
CREATE POLICY "Group members can update group images"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'group-images'
        AND public.is_group_member(((storage.foldername(name))[1])::uuid)
    );

DROP POLICY IF EXISTS "Group members can delete group images" ON storage.objects;
CREATE POLICY "Group members can delete group images"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'group-images'
        AND public.is_group_member(((storage.foldername(name))[1])::uuid)
    );
