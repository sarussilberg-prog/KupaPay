import { Platform } from 'react-native';

const mockUpload = jest.fn().mockResolvedValue({ error: null });
const mockGetPublicUrl = jest.fn().mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/avatar.jpg' } });
const mockFileBase64 = jest.fn();

jest.mock('../../lib/supabase', () => ({
    supabase: {
        storage: {
            from: jest.fn(() => ({
                upload: mockUpload,
                getPublicUrl: mockGetPublicUrl,
            })),
        },
    },
}));

jest.mock('expo-file-system', () => ({
    File: jest.fn().mockImplementation(() => ({
        base64: mockFileBase64,
    })),
}));

import { uploadProfileImage, uploadGroupImage } from '../../services/storage.service';

describe('storage.service uploadProfileImage', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        mockUpload.mockClear();
        mockGetPublicUrl.mockClear();
        mockFileBase64.mockReset();
        mockFileBase64.mockResolvedValue('Zm9v');
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('reads blob URLs via fetch on web', async () => {
        Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'web' });
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            headers: { get: () => 'image/png' },
            arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
        }) as unknown as typeof fetch;

        const url = await uploadProfileImage('user-1', 'blob:http://localhost/abc');

        expect(global.fetch).toHaveBeenCalledWith('blob:http://localhost/abc');
        expect(mockFileBase64).not.toHaveBeenCalled();
        expect(mockUpload).toHaveBeenCalledWith(
            'user-1/avatar.jpg',
            expect.any(Uint8Array),
            { contentType: 'image/png', upsert: true },
        );
        expect(url).toMatch(/^https:\/\/cdn\.example\.com\/avatar\.jpg\?t=\d+$/);
    });

    it('reads file URIs via expo-file-system on native', async () => {
        Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'ios' });

        const url = await uploadProfileImage('user-1', 'file:///tmp/photo.png');

        expect(mockFileBase64).toHaveBeenCalled();
        expect(mockUpload).toHaveBeenCalledWith(
            'user-1/avatar.png',
            expect.any(Uint8Array),
            { contentType: 'image/png', upsert: true },
        );
        expect(url).toMatch(/^https:\/\/cdn\.example\.com\/avatar\.jpg\?t=\d+$/);
    });
});

describe('storage.service uploadGroupImage', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        mockUpload.mockClear();
        mockGetPublicUrl.mockClear();
        mockFileBase64.mockReset();
        mockFileBase64.mockResolvedValue('Zm9v');
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('uploads to a fixed avatar.jpg path for consistent replacement', async () => {
        Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'ios' });

        const url = await uploadGroupImage('group-1', 'file:///tmp/photo.png');

        expect(mockUpload).toHaveBeenCalledWith(
            'group-1/avatar.jpg',
            expect.any(Uint8Array),
            { contentType: 'image/png', upsert: true },
        );
        expect(url).toMatch(/^https:\/\/cdn\.example\.com\/avatar\.jpg\?t=\d+$/);
    });
});
