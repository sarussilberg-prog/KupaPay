import type { QueryKey } from '@tanstack/react-query';
import { queryClient } from './queryClient';

/** Skip snapshot invalidation when a fetch just finished (avoids mount + SUBSCRIBED dupes). */
export const REALTIME_SUBSCRIBE_REFETCH_GRACE_MS = 5_000;

/**
 * Reconcile missed realtime events after (re)subscribe without doubling a fetch
 * that just ran from prefetch or mount.
 */
export function invalidateQueriesUnlessRecentlyFetched(
    queryKey: QueryKey,
    graceMs: number = REALTIME_SUBSCRIBE_REFETCH_GRACE_MS,
): void {
    const state = queryClient.getQueryState(queryKey);
    if (state?.fetchStatus === 'fetching') return;
    if (
        state?.dataUpdatedAt != null &&
        Date.now() - state.dataUpdatedAt < graceMs
    ) {
        return;
    }
    void queryClient.invalidateQueries({ queryKey });
}
