import { useInfiniteQuery } from '@tanstack/react-query';
import {
    fetchRecentActivity,
    ACTIVITY_INITIAL_PAGE_SIZE,
    ACTIVITY_PAGE_SIZE,
} from '../../services/activity.service';
import { queryClient } from '../../lib/queryClient';
import { queryKeys } from './keys';
import { useAuthUserId } from '../useAuthUserId';
import { useAppStore } from '../../store';

const ACTIVITY_STALE_MS = 60_000;

function buildActivityQueryOptions() {
    return {
        queryKey: queryKeys.activityFeed(),
        queryFn: ({ pageParam }: { pageParam?: string }) =>
            fetchRecentActivity({
                before: pageParam,
                limit: pageParam ? ACTIVITY_PAGE_SIZE : ACTIVITY_INITIAL_PAGE_SIZE,
            }),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage: Awaited<ReturnType<typeof fetchRecentActivity>>) =>
            lastPage.nextCursor,
        staleTime: ACTIVITY_STALE_MS,
    };
}

export function useActivityQuery() {
    const currentUserId = useAuthUserId();
    return useInfiniteQuery({
        ...buildActivityQueryOptions(),
        enabled: Boolean(currentUserId),
    });
}

export function prefetchActivityFeed(): Promise<void> {
    const store = useAppStore.getState();
    const currentUserId = store.currentUser?.id ?? store.session?.user?.id;
    if (!currentUserId) return Promise.resolve();
    const options = buildActivityQueryOptions();
    const existing = queryClient.getQueryState(options.queryKey);
    if (
        existing?.dataUpdatedAt &&
        Date.now() - existing.dataUpdatedAt < ACTIVITY_STALE_MS
    ) {
        return Promise.resolve();
    }
    return queryClient.prefetchInfiniteQuery(options);
}
