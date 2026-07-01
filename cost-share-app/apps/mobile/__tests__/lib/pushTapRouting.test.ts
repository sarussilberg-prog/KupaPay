import { notificationDataToPendingNavigation } from '../../lib/pushTapRouting';

describe('notificationDataToPendingNavigation', () => {
    it('routes expense events to the group', () => {
        expect(notificationDataToPendingNavigation({ kind: 'expense_added', groupId: 'g1', refId: 'r1' }))
            .toEqual({ target: 'groupDetail', groupId: 'g1' });
    });
    it('routes settlement and message events to the group', () => {
        expect(notificationDataToPendingNavigation({ kind: 'settlement_added', groupId: 'g2', refId: 'r' }))
            .toEqual({ target: 'groupDetail', groupId: 'g2' });
        expect(notificationDataToPendingNavigation({ kind: 'message_posted', groupId: 'g3', refId: 'r' }))
            .toEqual({ target: 'groupDetail', groupId: 'g3' });
    });
    it('routes consolidation_batch_added to the group', () => {
        expect(notificationDataToPendingNavigation({ kind: 'consolidation_batch_added', groupId: 'g5', refId: 'r' }))
            .toEqual({ target: 'groupDetail', groupId: 'g5' });
    });
    it('returns null for consolidation_batch_added without a groupId', () => {
        expect(notificationDataToPendingNavigation({ kind: 'consolidation_batch_added', groupId: null, refId: 'r' }))
            .toBeNull();
    });
    it('routes friend requests to the friends screen', () => {
        expect(notificationDataToPendingNavigation({ kind: 'friend_request_received', groupId: null, refId: 'r' }))
            .toEqual({ target: 'friends' });
    });
    it('routes group_removed to the groups list', () => {
        expect(notificationDataToPendingNavigation({ kind: 'group_removed', groupId: 'g9', refId: 'r' }))
            .toEqual({ target: 'groupsList' });
    });
    it('returns null for unknown / malformed payloads', () => {
        expect(notificationDataToPendingNavigation({})).toBeNull();
        expect(notificationDataToPendingNavigation({ kind: 'expense_added', groupId: null, refId: 'r' })).toBeNull();
    });
});
