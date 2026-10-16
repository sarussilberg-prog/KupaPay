import { referralInviteUrl } from '../../services/referral.service';

describe('referral.service', () => {
    it('builds friend invite URL from token', () => {
        expect(referralInviteUrl('abc123')).toContain('/i/abc123');
    });
});
