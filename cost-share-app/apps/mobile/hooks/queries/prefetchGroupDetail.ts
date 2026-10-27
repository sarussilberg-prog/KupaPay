/**
 * Warm caches before navigating to GroupDetail — expenses, messages, members,
 * settlements. Each prefetchQuery is a no-op if the key is already fresh in
 * the React Query cache, so callers don't need to gate.
 */

import { fetchGroupUsers } from '../../services/users.service';
import { fetchSettlements } from '../../services/settlements.service';
import { queryClient } from '../../lib/queryClient';
import { queryKeys } from './keys';
import {
    groupExpensesQueryOptions,
    groupMessagesQueryOptions,
} from './groupDetailQueryOptions';

export function prefetchGroupDetail(groupId: string): void {
    if (!groupId) return;

    void queryClient.prefetchQuery(groupExpensesQueryOptions(groupId));
    void queryClient.prefetchQuery(groupMessagesQueryOptions(groupId));
    void queryClient.prefetchQuery({
        queryKey: queryKeys.groupUsers(groupId),
        queryFn: () => fetchGroupUsers(groupId),
    });
    void queryClient.prefetchQuery({
        queryKey: queryKeys.groupSettlements(groupId),
        queryFn: () => fetchSettlements(groupId),
    });
}
