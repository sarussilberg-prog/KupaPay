import { queryClient } from '../../../lib/queryClient';
import { groupsQueryOptions } from '../../../hooks/queries/groupsQueryOptions';
import { fetchGroups } from '../../../services/groups.service';

jest.mock('../../../services/groups.service', () => ({
    fetchGroups: jest.fn().mockResolvedValue([{ id: 'g1' }]),
}));

const mockFetchGroups = fetchGroups as jest.MockedFunction<typeof fetchGroups>;

describe('groupsQueryOptions / React Query dedupe', () => {
    beforeEach(() => {
        queryClient.clear();
        mockFetchGroups.mockClear();
    });

    it('issues one fetchGroups call when gate prefetch and fetchQuery run together', async () => {
        let resolveFetch: (value: unknown[]) => void = () => {};
        mockFetchGroups.mockImplementation(
            () =>
                new Promise(resolve => {
                    resolveFetch = resolve;
                }) as never,
        );

        const first = queryClient.fetchQuery(groupsQueryOptions());
        const second = queryClient.prefetchQuery(groupsQueryOptions());

        expect(mockFetchGroups).toHaveBeenCalledTimes(1);

        resolveFetch([{ id: 'g1' }]);
        await Promise.all([first, second]);

        expect(mockFetchGroups).toHaveBeenCalledTimes(1);
    });
});
