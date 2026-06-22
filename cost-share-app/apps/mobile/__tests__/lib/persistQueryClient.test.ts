import { QueryClient, dehydrate, hydrate } from '@tanstack/react-query';
import {
    PERSIST_ALLOWLIST_PREFIXES,
    PERSIST_SCHEMA_VERSION,
    computePersistBuster,
    shouldDehydrateQueryFactory,
    shouldDehydrateMutationFactory,
} from '../../lib/persistQueryClient';

describe('persistQueryClient helpers', () => {
    it('PERSIST_SCHEMA_VERSION is a non-empty string', () => {
        expect(typeof PERSIST_SCHEMA_VERSION).toBe('string');
        expect(PERSIST_SCHEMA_VERSION.length).toBeGreaterThan(0);
    });

    it('allowlist contains every documented prefix', () => {
        expect(PERSIST_ALLOWLIST_PREFIXES).toEqual(
            expect.arrayContaining([
                'groups',
                'groupExpenses',
                'groupMessages',
                'groupMembers',
                'groupUsers',
                'groupSettlements',
                'groupPairwiseDebts',
                'group-simplified-debts-by-currency',
                'group-contributions',
                'balanceSummary',
                'simplifiedDebts',
                'dashboard',
                'activity',
                'friends',
                'friend-requests',
            ]),
        );
    });

    it('persists the canonical simplifiedDebts balance query (needed for offline balances)', () => {
        const fn = shouldDehydrateQueryFactory();
        expect(
            fn({ queryKey: ['simplifiedDebts'], state: { status: 'success' } } as any),
        ).toBe(true);
    });

    it('shouldDehydrateQuery accepts allowlisted keys with status=success', () => {
        const fn = shouldDehydrateQueryFactory();
        expect(fn({ queryKey: ['groups'], state: { status: 'success' } } as any)).toBe(true);
        expect(
            fn({ queryKey: ['groupExpenses', 'g1'], state: { status: 'success' } } as any),
        ).toBe(true);
    });

    it('shouldDehydrateQuery rejects unknown keys', () => {
        const fn = shouldDehydrateQueryFactory();
        expect(
            fn({
                queryKey: ['legal-document', 'terms', 'en'],
                state: { status: 'success' },
            } as any),
        ).toBe(false);
        expect(fn({ queryKey: ['adminSentryIssues'], state: { status: 'success' } } as any)).toBe(
            false,
        );
    });

    it('persists errored queries that still hold last-known-good data (offline must not evict the cache)', () => {
        // When a refetch fails offline the query goes to status=error but keeps
        // its previous data in memory. If we drop it from the persisted snapshot
        // the next cold start offline restores nothing → "no groups". Keep it.
        const fn = shouldDehydrateQueryFactory();
        expect(
            fn({ queryKey: ['groups'], state: { status: 'error', data: [{ id: 'g1' }] } } as any),
        ).toBe(true);
        expect(
            fn({
                queryKey: ['simplifiedDebts'],
                state: { status: 'error', data: { groups: [] } },
            } as any),
        ).toBe(true);
    });

    it('shouldDehydrateQuery rejects pending queries and errored queries with no data', () => {
        const fn = shouldDehydrateQueryFactory();
        expect(
            fn({ queryKey: ['groups'], state: { status: 'pending', data: undefined } } as any),
        ).toBe(false);
        expect(
            fn({ queryKey: ['groups'], state: { status: 'error', data: undefined } } as any),
        ).toBe(false);
    });

    it('shouldDehydrateMutation accepts paused addExpense mutations', () => {
        const fn = shouldDehydrateMutationFactory();
        expect(
            fn({
                options: { mutationKey: ['addExpense', 'pending_x'] },
                state: { isPaused: true },
            } as any),
        ).toBe(true);
    });

    it('shouldDehydrateMutation rejects other mutations', () => {
        const fn = shouldDehydrateMutationFactory();
        expect(
            fn({
                options: { mutationKey: ['deleteGroup', 'g1'] },
                state: { isPaused: true },
            } as any),
        ).toBe(false);
        expect(
            fn({ options: { mutationKey: undefined }, state: { isPaused: true } } as any),
        ).toBe(false);
    });

    it('an errored query that still holds data survives a dehydrate→hydrate round-trip', async () => {
        // End-to-end guard for the offline-eviction bug: a query that was
        // fetched online (good data) then errored on an offline refetch must
        // still restore its last-known-good data on the next cold start.
        const source = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        source.setQueryData(['groups'], [{ id: 'g1' }]);
        await source
            .fetchQuery({
                queryKey: ['groups'],
                queryFn: async () => {
                    throw new Error('offline');
                },
            })
            .catch(() => undefined);

        const errored = source.getQueryCache().find({ queryKey: ['groups'] });
        expect(errored?.state.status).toBe('error');
        expect(errored?.state.data).toEqual([{ id: 'g1' }]);

        const dehydrated = dehydrate(source, {
            shouldDehydrateQuery: shouldDehydrateQueryFactory(),
        });

        const target = new QueryClient();
        hydrate(target, dehydrated);
        expect(target.getQueryData(['groups'])).toEqual([{ id: 'g1' }]);
    });

    it('computePersistBuster combines app version and schema version (NOT userId)', () => {
        const a = computePersistBuster({ appVersion: '1.2.3' });
        const b = computePersistBuster({ appVersion: '1.2.4' });
        expect(a).not.toEqual(b);
        expect(a).toEqual(computePersistBuster({ appVersion: '1.2.3' }));
    });

    it('computePersistBuster is independent of userId (isolation handled by wipe on sign-in/out)', () => {
        const a = computePersistBuster({ appVersion: '1.2.3' });
        const b = computePersistBuster({ appVersion: '1.2.3' });
        expect(a).toEqual(b);
    });
});
