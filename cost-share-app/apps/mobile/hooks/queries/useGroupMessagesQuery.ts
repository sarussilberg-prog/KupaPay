import { useQuery } from '@tanstack/react-query';
import { groupMessagesQueryOptions } from './groupDetailQueryOptions';

export function useGroupMessagesQuery(groupId: string) {
    return useQuery({
        ...groupMessagesQueryOptions(groupId),
        refetchOnMount: false,
        refetchOnWindowFocus: false,
    });
}
