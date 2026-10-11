import { normalizeExpenseReceiptStoragePath } from '@cost-share/shared';
import { supabase } from '../lib/supabase';

const EXPENSE_RECEIPTS_BUCKET = 'expense-receipts';
const SIGNED_URL_TTL_SEC = 3600;

/** Resolve DB path or legacy public URL to a short-lived signed URL for display. */
export async function resolveExpenseReceiptDisplayUrl(
    stored: string | null | undefined,
): Promise<string | null> {
    const path = normalizeExpenseReceiptStoragePath(stored);
    if (!path) return null;

    const { data, error } = await supabase.storage
        .from(EXPENSE_RECEIPTS_BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_SEC);

    if (error || !data?.signedUrl) {
        console.warn('resolveExpenseReceiptDisplayUrl failed:', error?.message ?? 'no url');
        return null;
    }
    return data.signedUrl;
}
