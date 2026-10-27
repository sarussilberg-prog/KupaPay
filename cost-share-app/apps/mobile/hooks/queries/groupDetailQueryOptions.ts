import { fetchExpenses } from '../../services/expenses.service';
import { fetchMessages } from '../../services/messages.service';
import { queryKeys } from './keys';

/** Align with canonical balance hook; realtime + SUBSCRIBED reconcile when stale. */
export const GROUP_DETAIL_QUERY_STALE_MS = 60_000;

export function groupExpensesQueryOptions(groupId: string) {
    return {
        queryKey: queryKeys.groupExpenses(groupId),
        queryFn: () => fetchExpenses(groupId),
        enabled: Boolean(groupId),
        staleTime: GROUP_DETAIL_QUERY_STALE_MS,
    } as const;
}

export function groupMessagesQueryOptions(groupId: string) {
    return {
        queryKey: queryKeys.groupMessages(groupId),
        queryFn: () => fetchMessages(groupId),
        enabled: Boolean(groupId),
        staleTime: GROUP_DETAIL_QUERY_STALE_MS,
    } as const;
}
