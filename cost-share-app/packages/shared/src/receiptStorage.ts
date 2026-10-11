/**
 * Expense receipt references in `expenses.receipt_url` are storage paths
 * (`<groupId>/<filename>`). Legacy rows may still hold public object URLs.
 */

const LEGACY_PUBLIC_PATH_RE =
    /\/storage\/v1\/object\/public\/expense-receipts\/([^?#]+)/i;

const STORAGE_PATH_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/.+/i;

/** Normalize DB value to a bucket-relative path, or null if empty/invalid. */
export function normalizeExpenseReceiptStoragePath(
    stored: string | null | undefined,
): string | null {
    if (stored == null) return null;
    const trimmed = stored.trim();
    if (!trimmed) return null;

    const legacy = trimmed.match(LEGACY_PUBLIC_PATH_RE);
    if (legacy?.[1]) {
        return decodeURIComponent(legacy[1].replace(/^\/+/, ''));
    }

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return null;
    }

    const withoutQuery = trimmed.split('?')[0] ?? trimmed;
    if (STORAGE_PATH_RE.test(withoutQuery)) {
        return withoutQuery.replace(/^\/+/, '');
    }

    return null;
}

export function isExpenseReceiptStoragePath(stored: string | null | undefined): boolean {
    return normalizeExpenseReceiptStoragePath(stored) != null;
}
