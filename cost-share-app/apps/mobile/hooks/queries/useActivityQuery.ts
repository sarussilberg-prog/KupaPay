import { useInfiniteQuery } from '@tanstack/react-query';
import {
    fetchRecentActivity,
    ACTIVITY_INITIAL_PAGE_SIZE,
    ACTIVITY_PAGE_SIZE,
} from '../../services/activity.service';
import { queryKeys } from './keys';

export function useActivityQuery() {
    return useInfiniteQuery({
        queryKey: queryKeys.activity,
        queryFn: ({ pageParam }) =>
            fetchRecentActivity({
                before: pageParam,
                limit: pageParam ? ACTIVITY_PAGE_SIZE : ACTIVITY_INITIAL_PAGE_SIZE,
            }),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
    });
}
