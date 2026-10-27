import { useQuery } from '@tanstack/react-query';
import { groupsQueryOptions } from './groupsQueryOptions';

export function useGroupsQuery() {
    return useQuery({
        ...groupsQueryOptions(),
        // Gate + prefetch warm this key via fetchQuery; app-level realtime
        // invalidates on membership/metadata changes and on reconnect.
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        retry: false,
    });
}
