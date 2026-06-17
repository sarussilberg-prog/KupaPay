/**
 * Warm profile-tab queries at app start: canonical balance + incoming requests
 * so ProfileScreen opens from cache.
 */

import { fetchSimplifiedInputs } from '../../services/simplifiedDebts.service';
import { fetchIncomingRequests } from '../../services/friends.service';
import { queryClient } from '../../lib/queryClient';
import { useAppStore } from '../../store';
import { queryKeys } from './keys';
import { INCOMING_REQUESTS_STALE_MS } from './useFriendsQueries';

let warmupInFlight: Promise<void> | null = null;

export function prefetchProfileWarmup(): void {
    const { currentUser } = useAppStore.getState();
    if (!currentUser?.id) return;
    if (warmupInFlight) return;

    warmupInFlight = Promise.all([
        queryClient.prefetchQuery({
            queryKey: queryKeys.simplifiedDebts,
            queryFn: fetchSimplifiedInputs,
        }),
        queryClient.prefetchQuery({
            queryKey: queryKeys.friendRequestsIncoming,
            queryFn: fetchIncomingRequests,
            staleTime: INCOMING_REQUESTS_STALE_MS,
        }),
    ])
        .then(() => undefined)
        .catch(err => {
            console.error('prefetchProfileWarmup failed:', err);
        })
        .finally(() => {
            warmupInFlight = null;
        });
}
