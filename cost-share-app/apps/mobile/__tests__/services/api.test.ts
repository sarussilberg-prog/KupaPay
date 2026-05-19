describe('api base URL', () => {
    const originalDev = (global as any).__DEV__;
    const originalEnv = process.env.EXPO_PUBLIC_API_URL;

    afterEach(() => {
        (global as any).__DEV__ = originalDev;
        if (originalEnv === undefined) {
            delete process.env.EXPO_PUBLIC_API_URL;
        } else {
            process.env.EXPO_PUBLIC_API_URL = originalEnv;
        }
        jest.resetModules();
    });

    it('uses EXPO_PUBLIC_API_URL when set', () => {
        process.env.EXPO_PUBLIC_API_URL = 'http://192.168.1.10:3000/api';
        jest.resetModules();
        const { getApiBaseUrl } = require('../../services/api');
        expect(getApiBaseUrl()).toBe('http://192.168.1.10:3000/api');
    });

    it('falls back to localhost in __DEV__ when env unset', () => {
        delete process.env.EXPO_PUBLIC_API_URL;
        (global as any).__DEV__ = true;
        jest.resetModules();
        const { getApiBaseUrl } = require('../../services/api');
        expect(getApiBaseUrl()).toBe('http://localhost:3000/api');
    });
});

jest.mock('../../lib/supabase', () => ({
    supabase: {
        auth: {
            getSession: jest.fn(),
        },
    },
}));

describe('api auth headers', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.doMock('../../lib/supabase', () => ({
            supabase: {
                auth: { getSession: jest.fn() },
            },
        }));
        global.fetch = jest.fn().mockResolvedValue({
            status: 200,
            json: async () => ({ success: true, data: [] }),
        }) as any;
    });

    it('sends Authorization Bearer when session exists', async () => {
        const { supabase } = require('../../lib/supabase');
        (supabase.auth.getSession as jest.Mock).mockResolvedValue({
            data: { session: { access_token: 'test-jwt-token' } },
        });

        const { apiGet } = require('../../services/api');
        await apiGet('/groups');

        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/groups'),
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: 'Bearer test-jwt-token',
                }),
            }),
        );
    });

    it('omits Authorization when no session', async () => {
        const { supabase } = require('../../lib/supabase');
        (supabase.auth.getSession as jest.Mock).mockResolvedValue({
            data: { session: null },
        });

        const { apiGet } = require('../../services/api');
        await apiGet('/groups');

        const [, options] = (global.fetch as jest.Mock).mock.calls[0];
        expect(options.headers.Authorization).toBeUndefined();
    });
});
