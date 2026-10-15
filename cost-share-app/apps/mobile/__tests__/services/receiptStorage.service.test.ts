const mockCreateSignedUrl = jest.fn();

jest.mock('../../lib/supabase', () => ({
    supabase: {
        storage: {
            from: jest.fn(() => ({
                createSignedUrl: mockCreateSignedUrl,
            })),
        },
    },
}));

import { resolveExpenseReceiptDisplayUrl } from '../../services/receiptStorage.service';

describe('resolveExpenseReceiptDisplayUrl', () => {
    beforeEach(() => {
        mockCreateSignedUrl.mockReset();
    });

    it('returns signed URL for storage path', async () => {
        mockCreateSignedUrl.mockResolvedValue({
            data: { signedUrl: 'https://signed.example/receipt.jpg' },
            error: null,
        });
        const groupId = '11111111-1111-4111-8111-111111111111';
        const path = `${groupId}/file.jpg`;
        const url = await resolveExpenseReceiptDisplayUrl(path);
        expect(url).toBe('https://signed.example/receipt.jpg');
        expect(mockCreateSignedUrl).toHaveBeenCalledWith(path, 3600);
    });

    it('returns null when signing fails', async () => {
        mockCreateSignedUrl.mockResolvedValue({ data: null, error: { message: 'denied' } });
        const url = await resolveExpenseReceiptDisplayUrl('11111111-1111-4111-8111-111111111111/x.jpg');
        expect(url).toBeNull();
    });
});
