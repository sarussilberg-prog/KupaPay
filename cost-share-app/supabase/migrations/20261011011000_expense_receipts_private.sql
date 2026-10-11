-- Private expense-receipts bucket: member-scoped SELECT + migrate public URLs to paths.

UPDATE storage.buckets
SET public = false
WHERE id = 'expense-receipts';

DROP POLICY IF EXISTS "Expense receipts are publicly readable" ON storage.objects; -- safe-breaking: security stack #113; policy/GRANT replaced in same migration

CREATE POLICY "Group members can read expense receipts"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'expense-receipts'
        AND public.is_group_member(((storage.foldername(name))[1])::uuid)
    );

-- Legacy rows stored full public URLs; keep working via path + signed URL clientside.
UPDATE public.expenses e
SET receipt_url = v.path
FROM (
    SELECT
        id,
        trim(both '/' from
            split_part(
                regexp_replace(
                    receipt_url,
                    '^https?://[^/]+/storage/v1/object/public/expense-receipts/',
                    '',
                    'i'
                ),
                '?',
                1
            )
        ) AS path
    FROM public.expenses
    WHERE receipt_url IS NOT NULL
      AND btrim(receipt_url) <> ''
      AND receipt_url ~* '/storage/v1/object/public/expense-receipts/'
) v
WHERE e.id = v.id
  AND v.path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/';
