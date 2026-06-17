/**
 * Per-group balance queries. The simplified-debts-by-currency variant is
 * subsumed by `useSimplifiedDebts` (one canonical hook for everything).
 */

import { useQuery } from '@tanstack/react-query';
import { getGroupContributions } from '../../services/groups.service';
import { queryKeys } from './keys';

export function useGroupContributionsQuery(groupId: string) {
    return useQuery({
        queryKey: queryKeys.groupContributions(groupId),
        queryFn: () => getGroupContributions(groupId),
        enabled: Boolean(groupId),
    });
}
