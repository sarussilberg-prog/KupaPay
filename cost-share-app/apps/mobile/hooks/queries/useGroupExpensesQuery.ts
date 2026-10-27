import { useQuery } from '@tanstack/react-query';
import { groupExpensesQueryOptions } from './groupDetailQueryOptions';

export function useGroupExpensesQuery(groupId: string) {
    return useQuery({
        ...groupExpensesQueryOptions(groupId),
        refetchOnMount: false,
        refetchOnWindowFocus: false,
    });
}
