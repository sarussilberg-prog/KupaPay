import { invalidateGroupMembersCaches } from '../../hooks/useGroupMembersRealtime';
import { queryClient } from '../../lib/queryClient';
import { queryKeys } from '../../hooks/queries/keys';

jest.mock('../../lib/queryClient', () => ({
    queryClient: {
        invalidateQueries: jest.fn(),
    },
}));

jest.mock('../../lib/invalidateBalanceCaches', () => ({
    invalidateBalanceCaches: jest.fn(),
}));

import { invalidateBalanceCaches } from '../../lib/invalidateBalanceCaches';

describe('invalidateGroupMembersCaches', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('invalidates groups, groupUsers, and balances', () => {
        invalidateGroupMembersCaches('g1');
        expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
            queryKey: queryKeys.groups,
        });
        expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
            queryKey: queryKeys.groupUsers('g1'),
        });
        expect(invalidateBalanceCaches).toHaveBeenCalledWith('g1');
    });
});
