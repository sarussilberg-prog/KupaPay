import {
    isExpenseReceiptStoragePath,
    normalizeExpenseReceiptStoragePath,
} from '@cost-share/shared';

describe('receiptStorage (shared)', () => {
    const groupId = '11111111-1111-4111-8111-111111111111';
    const path = `${groupId}/1700000000-123.jpg`;

    it('normalizes legacy public URLs to paths', () => {
        const url = `https://x.supabase.co/storage/v1/object/public/expense-receipts/${path}?t=1`;
        expect(normalizeExpenseReceiptStoragePath(url)).toBe(path);
        expect(isExpenseReceiptStoragePath(url)).toBe(true);
    });
});
