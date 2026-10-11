const mockUpload = jest.fn().mockResolvedValue({ error: null });
const mockFileBase64 = jest.fn().mockResolvedValue('Zm9v');

jest.mock('../../lib/supabase', () => ({
    supabase: {
        storage: {
            from: jest.fn(() => ({
                upload: mockUpload,
                getPublicUrl: jest.fn(),
            })),
        },
    },
}));

jest.mock('expo-file-system', () => ({
    File: jest.fn().mockImplementation(() => ({
        base64: mockFileBase64,
    })),
}));

import { Platform } from 'react-native';
import { uploadExpenseReceipt } from '../../services/storage.service';

describe('uploadExpenseReceipt', () => {
    beforeEach(() => {
        mockUpload.mockClear();
        Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'ios' });
    });

    it('returns bucket-relative path instead of public URL', async () => {
        const groupId = '11111111-1111-4111-8111-111111111111';
        const path = await uploadExpenseReceipt(groupId, 'file:///tmp/r.jpg');
        expect(path).toMatch(new RegExp(`^${groupId}/\\d+-\\d+\\.jpg$`));
    });
});
