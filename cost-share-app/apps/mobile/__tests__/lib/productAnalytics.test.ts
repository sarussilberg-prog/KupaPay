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
    const mockClient = {
        capture: jest.fn(),
        identify: jest.fn(),
        reset: jest.fn(),
    };

    const prevKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
    const prevLegacyKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
    const prevHost = process.env.EXPO_PUBLIC_POSTHOG_HOST;

    beforeEach(() => {
        mockClient.capture.mockClear();
        mockClient.identify.mockClear();
        mockClient.reset.mockClear();
        delete process.env.EXPO_PUBLIC_POSTHOG_HOST;
    });

    afterEach(() => {
        if (prevKey === undefined) delete process.env.EXPO_PUBLIC_POSTHOG_KEY;
        else process.env.EXPO_PUBLIC_POSTHOG_KEY = prevKey;
        if (prevLegacyKey === undefined) delete process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
        else process.env.EXPO_PUBLIC_POSTHOG_API_KEY = prevLegacyKey;
        if (prevHost === undefined) delete process.env.EXPO_PUBLIC_POSTHOG_HOST;
        else process.env.EXPO_PUBLIC_POSTHOG_HOST = prevHost;
        jest.resetModules();
    });

    it('no-ops when PostHog key is explicitly disabled', async () => {
        process.env.EXPO_PUBLIC_POSTHOG_KEY = '';
        const {
            captureProductEvent,
            setProductAnalyticsClient,
        } = require('../../lib/productAnalytics');
        setProductAnalyticsClient(mockClient);
        await captureProductEvent('app_open');
        expect(mockClient.capture).not.toHaveBeenCalled();
    });

    it('no-ops when client is not bound', async () => {
        process.env.EXPO_PUBLIC_POSTHOG_KEY = 'phc_test';
        const { captureProductEvent, setProductAnalyticsClient } = require('../../lib/productAnalytics');
        setProductAnalyticsClient(null);
        await captureProductEvent('expense_added', { group_id: 'g1' });
        expect(mockClient.capture).not.toHaveBeenCalled();
    });

    it('captures events with distinct_id when configured and bound', async () => {
        process.env.EXPO_PUBLIC_POSTHOG_KEY = 'phc_test';
        const { captureProductEvent, setProductAnalyticsClient } = require('../../lib/productAnalytics');
        setProductAnalyticsClient(mockClient);
        await captureProductEvent('expense_added', { group_id: 'g1' });
        expect(mockClient.identify).toHaveBeenCalledWith('user-1', {});
        expect(mockClient.capture).toHaveBeenCalledWith(
            'expense_added',
            expect.objectContaining({
                group_id: 'g1',
                platform: expect.stringMatching(/^(ios|android|web)$/),
                app_version: expect.any(String),
                locale: expect.any(String),
                $lib: expect.stringMatching(/^kupapay-/),
            }),
        );
    });

    it('identify uses user id only (no email / PII)', async () => {
        process.env.EXPO_PUBLIC_POSTHOG_KEY = 'phc_test';
        const { identifyProductUser, setProductAnalyticsClient } = require('../../lib/productAnalytics');
        setProductAnalyticsClient(mockClient);
        await identifyProductUser('user-1');
        expect(mockClient.identify).toHaveBeenCalledWith('user-1', {});
    });

    it('fires second_group_member_joined when count is 2', async () => {
        process.env.EXPO_PUBLIC_POSTHOG_KEY = 'phc_test';
        mockFrom.mockReturnValue({
            select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({ count: 2, error: null }),
                }),
            }),
        });
        const { trackSecondGroupMemberJoined, setProductAnalyticsClient } =
            require('../../lib/productAnalytics');
        setProductAnalyticsClient(mockClient);
        await trackSecondGroupMemberJoined('g1');
        expect(mockClient.capture).toHaveBeenCalledWith(
            'second_group_member_joined',
            expect.objectContaining({ group_id: 'g1' }),
        );
    });

    it('detects new account signup from auth timestamps', () => {
        const { isNewAccountSignup } = require('../../lib/productAnalytics');
        const now = new Date().toISOString();
        expect(
            isNewAccountSignup({ created_at: now, last_sign_in_at: now }),
        ).toBe(true);
        expect(
            isNewAccountSignup({
                created_at: '2020-01-01T00:00:00.000Z',
                last_sign_in_at: '2026-01-01T00:00:00.000Z',
            }),
        ).toBe(false);
    });
});
