/**
 * invalidateBalanceCaches — single source of truth for what must be refreshed
 * when an expense or settlement changes. One query key now feeds every balance
 * UI; this helper exists so callers don't drift apart over time.
 *
 * `groupId` is optional: when provided, the per-group settlement-history list
 * is also invalidated (SettleUpListScreen's history rows). When omitted, every
 * group's settlement history is invalidated via a predicate.
 */

import { queryClient } from './queryClient';
import { queryKeys } from '../hooks/queries/keys';

export function invalidateBalanceCaches(groupId?: string): void {
    void queryClient.invalidateQueries({ queryKey: queryKeys.simplifiedDebts });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    if (groupId) {
        void queryClient.invalidateQueries({
            queryKey: queryKeys.groupSettlements(groupId),
        });
    } else {
        void queryClient.invalidateQueries({
            predicate: q =>
                Array.isArray(q.queryKey) && q.queryKey[0] === 'groupSettlements',
        });
    }
}
