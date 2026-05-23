import { assertProfileActiveWithTimeout } from '../../lib/auth';

const mockMaybeSingle = jest.fn();
const mockSignOut = jest.fn().mockResolvedValue({ error: null });

jest.mock('../../lib/supabase', () => ({
    supabase: {
        auth: {
            getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
            signOut: (...args: unknown[]) => mockSignOut(...args),
        },
        from: jest.fn(() => ({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: mockMaybeSingle,
        })),
    },
}));

describe('assertProfileActiveWithTimeout', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        mockMaybeSingle.mockReset();
        mockSignOut.mockClear();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('returns deactivated when profile is inactive', async () => {
        mockMaybeSingle.mockResolvedValue({ data: { is_active: false }, error: null });
        await expect(assertProfileActiveWithTimeout(100)).resolves.toBe('deactivated');
        expect(mockSignOut).toHaveBeenCalled();
    });

    it('fail-opens to active when the profile check exceeds the timeout', async () => {
        mockMaybeSingle.mockReturnValue(new Promise(() => {}));
        const pending = assertProfileActiveWithTimeout(50);
        jest.advanceTimersByTime(50);
        await expect(pending).resolves.toBe('active');
    });
});
