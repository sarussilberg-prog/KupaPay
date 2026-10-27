import { buildInviteUrl, buildPublicGroupBalanceUrl, buildSettleReminderUrl } from '../urls';

describe('invite urls', () => {
    it('builds friend invite URL', () => {
        expect(buildInviteUrl('friend', 'AbCd123_-9')).toBe('https://kupa-pay.com/i/AbCd123_-9');
    });

    it('builds group invite URL', () => {
        expect(buildInviteUrl('group', 'XyZ4567890')).toBe('https://kupa-pay.com/g/XyZ4567890');
    });

    it('builds settle reminder URL', () => {
        expect(buildSettleReminderUrl('Tok1234567')).toBe('https://kupa-pay.com/sr/Tok1234567');
    });

    it('builds public balance page URL', () => {
        expect(buildPublicGroupBalanceUrl('BalTok1234567')).toBe('https://kupa-pay.com/b/BalTok1234567');
    });
});
