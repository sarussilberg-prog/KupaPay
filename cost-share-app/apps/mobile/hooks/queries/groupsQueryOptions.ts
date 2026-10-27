import { fetchGroups } from '../../services/groups.service';
import { queryKeys } from './keys';

/** Shared React Query config for the groups list (gate, prefetch, hooks). */
export const GROUPS_QUERY_STALE_MS = 60_000;

export function groupsQueryOptions() {
    return {
        queryKey: queryKeys.groups,
        queryFn: () => fetchGroups(),
        staleTime: GROUPS_QUERY_STALE_MS,
    } as const;
}
