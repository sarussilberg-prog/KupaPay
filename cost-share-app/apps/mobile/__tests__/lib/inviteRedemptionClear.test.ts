import { shouldClearPendingInviteAfterRedemption } from '../../lib/inviteRedemptionClear';

describe('shouldClearPendingInviteAfterRedemption', () => {
    it('clears after successful friend redemption', () => {
        expect(shouldClearPendingInviteAfterRedemption({ kind: 'friend' })).toBe(true);
    });

    it('clears after successful group redemption', () => {
        expect(
            shouldClearPendingInviteAfterRedemption({ kind: 'group', groupId: 'g-1' }),
        ).toBe(true);
    });

    it('keeps pending invite when redemption failed', () => {
        expect(shouldClearPendingInviteAfterRedemption(null)).toBe(false);
    });
});
