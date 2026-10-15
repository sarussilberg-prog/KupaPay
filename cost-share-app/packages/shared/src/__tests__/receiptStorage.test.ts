import {
    isExpenseReceiptStoragePath,
    normalizeExpenseReceiptStoragePath,
} from '../receiptStorage';

describe('normalizeExpenseReceiptStoragePath', () => {
    const groupId = '11111111-1111-4111-8111-111111111111';
    const path = `${groupId}/1700000000-123.jpg`;

    it('returns path when already normalized', () => {
        expect(normalizeExpenseReceiptStoragePath(path)).toBe(path);
    });

    it('extracts path from legacy public URL', () => {
        const url = `https://drxfbicunusmipdgbgdk.supabase.co/storage/v1/object/public/expense-receipts/${path}?t=1`;
        expect(normalizeExpenseReceiptStoragePath(url)).toBe(path);
    });

    it('returns null for empty and unknown http URLs', () => {
        expect(normalizeExpenseReceiptStoragePath('')).toBeNull();
        expect(normalizeExpenseReceiptStoragePath('https://example.com/x.jpg')).toBeNull();
    });

    it('isExpenseReceiptStoragePath reflects normalization', () => {
        expect(isExpenseReceiptStoragePath(path)).toBe(true);
        expect(isExpenseReceiptStoragePath('not-a-path')).toBe(false);
    });
});
