/**
 * Warm groups list as soon as the user is signed in, so the Groups tab
 * renders from cache instead of waiting on mount. The canonical balance
 * cache is React-Query-owned and warms on first observer.
 */

import { fetchSimplifiedInputs } from '../../services/simplifiedDebts.service';
import { queryClient } from '../../lib/queryClient';
import { queryKeys } from './keys';
import { groupsQueryOptions } from './groupsQueryOptions';
import { useAppStore } from '../../store';

let prefetchInFlight: Promise<void> | null = null;

export function prefetchGroupsList(): void {
    const { currentUser } = useAppStore.getState();
    if (!currentUser?.id) return;

    if (prefetchInFlight) return;

    prefetchInFlight = Promise.all([
        queryClient.prefetchQuery(groupsQueryOptions()),
        queryClient.prefetchQuery({
            queryKey: queryKeys.simplifiedDebts,
            queryFn: fetchSimplifiedInputs,
        }),
    ])
        .then(() => undefined)
        .catch(err => {
            console.error('prefetchGroupsList failed:', err);
        })
        .finally(() => {
            prefetchInFlight = null;
        });
}
