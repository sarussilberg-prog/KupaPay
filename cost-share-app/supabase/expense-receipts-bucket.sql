-- Idempotent: private expense-receipts bucket. Path: <groupId>/<filename>.
-- Clients store paths in expenses.receipt_url and use signed URLs to display.

INSERT INTO storage.buckets (id, name, public)
VALUES ('expense-receipts', 'expense-receipts', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Expense receipts are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Group members can read expense receipts" ON storage.objects;
CREATE POLICY "Group members can read expense receipts"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'expense-receipts'
        AND public.is_group_member(((storage.foldername(name))[1])::uuid)
    );

DROP POLICY IF EXISTS "Group members can upload expense receipts" ON storage.objects;
CREATE POLICY "Group members can upload expense receipts"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'expense-receipts'
        AND public.is_group_member(((storage.foldername(name))[1])::uuid)
    );

DROP POLICY IF EXISTS "Group members can update expense receipts" ON storage.objects;
CREATE POLICY "Group members can update expense receipts"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'expense-receipts'
        AND public.is_group_member(((storage.foldername(name))[1])::uuid)
    );

DROP POLICY IF EXISTS "Group members can delete expense receipts" ON storage.objects;
CREATE POLICY "Group members can delete expense receipts"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'expense-receipts'
        AND public.is_group_member(((storage.foldername(name))[1])::uuid)
    );
