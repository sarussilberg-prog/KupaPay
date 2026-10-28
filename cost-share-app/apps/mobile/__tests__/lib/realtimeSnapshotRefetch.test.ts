import { queryClient } from '../../lib/queryClient';
import { queryKeys } from '../../hooks/queries/keys';
import {
    invalidateQueriesUnlessRecentlyFetched,
    REALTIME_SUBSCRIBE_REFETCH_GRACE_MS,
} from '../../lib/realtimeSnapshotRefetch';

describe('invalidateQueriesUnlessRecentlyFetched', () => {
    const key = queryKeys.groupExpenses('g1');

    beforeEach(() => {
        queryClient.clear();
        jest.spyOn(queryClient, 'invalidateQueries');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('skips invalidation when the query was fetched within the grace window', () => {
        queryClient.setQueryData(key, []);
        queryClient.getQueryCache().find({ queryKey: key })?.setState({
            dataUpdatedAt: Date.now(),
        });

        invalidateQueriesUnlessRecentlyFetched(key, REALTIME_SUBSCRIBE_REFETCH_GRACE_MS);

        expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
    });

    it('invalidates when data is older than the grace window', () => {
        queryClient.setQueryData(key, []);
        queryClient.getQueryCache().find({ queryKey: key })?.setState({
            dataUpdatedAt: Date.now() - REALTIME_SUBSCRIBE_REFETCH_GRACE_MS - 1,
        });

        invalidateQueriesUnlessRecentlyFetched(key, REALTIME_SUBSCRIBE_REFETCH_GRACE_MS);

        expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: key });
    });
});
