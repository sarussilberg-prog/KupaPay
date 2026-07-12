import {
    resolveAuthenticatedGateTarget,
    shouldMarkPostOnboardingAfterGroups,
    runAuthenticatedGate,
    type AuthenticatedGateDeps,
} from '../../lib/authenticatedGateResolve';

type FakeGroup = { id: string };

function makeDeps(
    overrides: Partial<AuthenticatedGateDeps> = {},
): { deps: AuthenticatedGateDeps; seedGroups: jest.Mock; markComplete: jest.Mock } {
    const seedGroups = jest.fn();
    const markComplete = jest.fn().mockResolvedValue(undefined);
    const deps: AuthenticatedGateDeps = {
        hasCompletedPostLoginOnboarding: jest.fn().mockResolvedValue(false),
        markPostLoginOnboardingComplete: markComplete,
        getCachedGroupsCount: jest.fn().mockReturnValue(0),
        isOnline: jest.fn().mockReturnValue(true),
        fetchGroups: jest.fn().mockResolvedValue([]),
        seedGroups,
        ...overrides,
    };
    return { deps, seedGroups, markComplete };
}

const group = (id: string): FakeGroup => ({ id });

describe('authenticatedGateResolve', () => {
    describe('resolveAuthenticatedGateTarget', () => {
        it('goes to main when post onboarding already complete', () => {
            expect(
                resolveAuthenticatedGateTarget({
                    postOnboardingComplete: true,
                    groupsCount: 0,
                    fetchFailed: false,
                }),
            ).toBe('main');
        });

        it('goes to main when user has groups', () => {
            expect(
                resolveAuthenticatedGateTarget({
                    postOnboardingComplete: false,
                    groupsCount: 2,
                    fetchFailed: false,
                }),
            ).toBe('main');
        });

        it('goes to create when user has no groups', () => {
            expect(
                resolveAuthenticatedGateTarget({
                    postOnboardingComplete: false,
                    groupsCount: 0,
                    fetchFailed: false,
                }),
            ).toBe('create');
        });

        it('goes to create on fetch failure (KI-002)', () => {
            expect(
                resolveAuthenticatedGateTarget({
                    postOnboardingComplete: false,
                    groupsCount: 0,
                    fetchFailed: true,
                }),
            ).toBe('create');
        });

        it('goes to create on fetch failure even if stale groupsCount were passed', () => {
            expect(
                resolveAuthenticatedGateTarget({
                    postOnboardingComplete: false,
                    groupsCount: 5,
                    fetchFailed: true,
                }),
            ).toBe('create');
        });
    });

    describe('shouldMarkPostOnboardingAfterGroups', () => {
        it('marks when first groups fetch returns rows', () => {
            expect(
                shouldMarkPostOnboardingAfterGroups({
                    postOnboardingComplete: false,
                    groupsCount: 1,
                    fetchFailed: false,
                }),
            ).toBe(true);
        });

        it('does not mark on fetch failure', () => {
            expect(
                shouldMarkPostOnboardingAfterGroups({
                    postOnboardingComplete: false,
                    groupsCount: 0,
                    fetchFailed: true,
                }),
            ).toBe(false);
        });
    });

    describe('runAuthenticatedGate', () => {
        it('goes straight to main with cached groups — no fetch, no re-seed', async () => {
            const { deps, seedGroups } = makeDeps({
                getCachedGroupsCount: jest.fn().mockReturnValue(2),
                hasCompletedPostLoginOnboarding: jest.fn().mockResolvedValue(true),
            });

            await expect(runAuthenticatedGate(deps)).resolves.toBe('main');
            expect(deps.fetchGroups).not.toHaveBeenCalled();
            expect(seedGroups).not.toHaveBeenCalled();
        });

        it('marks onboarding complete when cached groups exist but the flag was unset', async () => {
            const { deps, markComplete } = makeDeps({
                getCachedGroupsCount: jest.fn().mockReturnValue(1),
                hasCompletedPostLoginOnboarding: jest.fn().mockResolvedValue(false),
            });

            await expect(runAuthenticatedGate(deps)).resolves.toBe('main');
            expect(markComplete).toHaveBeenCalledTimes(1);
            expect(deps.fetchGroups).not.toHaveBeenCalled();
        });

        it('goes to main without fetching when offline and nothing is cached', async () => {
            const { deps, seedGroups } = makeDeps({
                getCachedGroupsCount: jest.fn().mockReturnValue(0),
                isOnline: jest.fn().mockReturnValue(false),
            });

            await expect(runAuthenticatedGate(deps)).resolves.toBe('main');
            expect(deps.fetchGroups).not.toHaveBeenCalled();
            expect(seedGroups).not.toHaveBeenCalled();
        });

        it('seeds fetched groups into the cache before main (the post-auth flash fix)', async () => {
            const fetched = [group('a'), group('b')];
            const { deps, seedGroups, markComplete } = makeDeps({
                getCachedGroupsCount: jest.fn().mockReturnValue(0),
                isOnline: jest.fn().mockReturnValue(true),
                hasCompletedPostLoginOnboarding: jest.fn().mockResolvedValue(false),
                fetchGroups: jest.fn().mockResolvedValue(fetched),
            });

            await expect(runAuthenticatedGate(deps)).resolves.toBe('main');
            expect(seedGroups).toHaveBeenCalledWith(fetched);
            expect(markComplete).toHaveBeenCalledTimes(1);
        });

        it('seeds an empty list for a returning user with no groups so the list screen can skip its splash', async () => {
            const { deps, seedGroups } = makeDeps({
                getCachedGroupsCount: jest.fn().mockReturnValue(0),
                isOnline: jest.fn().mockReturnValue(true),
                hasCompletedPostLoginOnboarding: jest.fn().mockResolvedValue(true),
                fetchGroups: jest.fn().mockResolvedValue([]),
            });

            await expect(runAuthenticatedGate(deps)).resolves.toBe('main');
            expect(seedGroups).toHaveBeenCalledWith([]);
        });

        it('routes a brand-new user with no groups to create (still seeds the empty list)', async () => {
            const { deps, seedGroups, markComplete } = makeDeps({
                getCachedGroupsCount: jest.fn().mockReturnValue(0),
                isOnline: jest.fn().mockReturnValue(true),
                hasCompletedPostLoginOnboarding: jest.fn().mockResolvedValue(false),
                fetchGroups: jest.fn().mockResolvedValue([]),
            });

            await expect(runAuthenticatedGate(deps)).resolves.toBe('create');
            expect(seedGroups).toHaveBeenCalledWith([]);
            expect(markComplete).not.toHaveBeenCalled();
        });

        it('does not seed on fetch failure and falls back per the resolver (KI-002)', async () => {
            const { deps, seedGroups } = makeDeps({
                getCachedGroupsCount: jest.fn().mockReturnValue(0),
                isOnline: jest.fn().mockReturnValue(true),
                hasCompletedPostLoginOnboarding: jest.fn().mockResolvedValue(false),
                fetchGroups: jest.fn().mockRejectedValue(new Error('timeout')),
            });

            await expect(runAuthenticatedGate(deps)).resolves.toBe('create');
            expect(seedGroups).not.toHaveBeenCalled();
        });
    });
});
