import { normalizeExpenseReceiptStoragePath } from '@cost-share/shared';
import { createClient } from './supabase/server';

const EXPENSE_RECEIPTS_BUCKET = 'expense-receipts';

/** Server-side signed URL for expense receipt paths (private bucket). */
export async function expenseReceiptSignedUrl(
    stored: string | null | undefined,
    expiresInSec = 3600,
): Promise<string | null> {
    const path = normalizeExpenseReceiptStoragePath(stored);
    if (!path) return null;

    const supabase = await createClient();
    const { data, error } = await supabase.storage
        .from(EXPENSE_RECEIPTS_BUCKET)
        .createSignedUrl(path, expiresInSec);

    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
}
