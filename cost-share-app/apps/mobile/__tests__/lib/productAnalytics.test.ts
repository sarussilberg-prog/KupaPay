const mockFetch = jest.fn().mockResolvedValue({ ok: true });
global.fetch = mockFetch as unknown as typeof fetch;

const mockFrom = jest.fn();

jest.mock('../../lib/auth', () => ({
    getCurrentUserId: jest.fn().mockResolvedValue('user-1'),
}));

jest.mock('../../lib/supabase', () => ({
    supabase: {
        from: (...args: unknown[]) => mockFrom(...args),
    },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
}));

describe('productAnalytics', () => {
    const prevKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
    const prevHost = process.env.EXPO_PUBLIC_POSTHOG_HOST;

    beforeEach(() => {
        delete process.env.EXPO_PUBLIC_POSTHOG_HOST;
        mockFetch.mockClear();
    });

    afterEach(() => {
        process.env.EXPO_PUBLIC_POSTHOG_API_KEY = prevKey;
        if (prevHost === undefined) {
            delete process.env.EXPO_PUBLIC_POSTHOG_HOST;
        } else {
            process.env.EXPO_PUBLIC_POSTHOG_HOST = prevHost;
        }
        jest.resetModules();
    });

    it('no-ops when EXPO_PUBLIC_POSTHOG_API_KEY is unset', async () => {
        delete process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
        const { captureProductEvent } = require('../../lib/productAnalytics');
        await captureProductEvent('signed_in');
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('posts capture payload when configured', async () => {
        process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'phc_test';
        const { captureProductEvent } = require('../../lib/productAnalytics');
        await captureProductEvent('expense_added', { group_id: 'g1' });
        expect(mockFetch).toHaveBeenCalledWith(
            'https://us.i.posthog.com/capture/',
            expect.objectContaining({ method: 'POST' }),
        );
        const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
        expect(body.event).toBe('expense_added');
        expect(body.distinct_id).toBe('user-1');
    });

    it('sends $identify for retention', async () => {
        process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'phc_test';
        const { identifyProductUser } = require('../../lib/productAnalytics');
        await identifyProductUser('user-1', { email: 'a@b.com' });
        const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
        expect(body.event).toBe('$identify');
        expect(body.distinct_id).toBe('user-1');
        expect(body.properties.$set.email).toBe('a@b.com');
    });

    it('fires second_group_member_joined when count is 2', async () => {
        process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'phc_test';
        mockFrom.mockReturnValue({
            select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({ count: 2, error: null }),
                }),
            }),
        });
        const { trackSecondGroupMemberJoined } = require('../../lib/productAnalytics');
        await trackSecondGroupMemberJoined('g1');
        const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
        expect(body.event).toBe('second_group_member_joined');
    });
});
