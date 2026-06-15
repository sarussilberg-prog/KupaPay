jest.mock('../../i18n', () => ({
    __esModule: true,
    default: {
        t: (key: string, vars?: Record<string, string>) => {
            if (key === 'invite.friend.shareMessage') {
                return `${vars?.inviterName} ${vars?.url}`;
            }
            if (key === 'invite.group.shareMessage') {
                return `${vars?.inviterName} ${vars?.groupName} ${vars?.url}`;
            }
            return key;
        },
    },
}));

import {
    buildInviteUrl,
    buildFriendInviteMessage,
    buildGroupInviteMessage,
} from '../../services/invite.service';

describe('invite.service', () => {
    describe('buildInviteUrl', () => {
        it('builds friend URL from token', () => {
            expect(buildInviteUrl('friend', 'AbCd123_-9')).toBe('https://kupa-pay.com/i/AbCd123_-9');
        });
        it('builds group URL from token', () => {
            expect(buildInviteUrl('group', 'XyZ4567890')).toBe('https://kupa-pay.com/g/XyZ4567890');
        });
    });

    describe('buildFriendInviteMessage', () => {
        it('interpolates inviter name and url', () => {
            const msg = buildFriendInviteMessage('נווה', 'https://kupa-pay.com/i/AAA');
            expect(msg).toContain('נווה');
            expect(msg).toContain('https://kupa-pay.com/i/AAA');
        });
    });

    describe('buildGroupInviteMessage', () => {
        it('interpolates inviter, group name, and url', () => {
            const msg = buildGroupInviteMessage('נווה', 'טיול ביוון', 'https://kupa-pay.com/g/BBB');
            expect(msg).toContain('נווה');
            expect(msg).toContain('טיול ביוון');
            expect(msg).toContain('https://kupa-pay.com/g/BBB');
        });
    });
});
