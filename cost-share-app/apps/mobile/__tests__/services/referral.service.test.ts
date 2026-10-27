import { buildInviteUrl } from '@cost-share/shared';
import { fetchMyReferralStatus, referralInviteUrl } from '../../services/referral.service';
import { supabase } from '../../lib/supabase';

jest.mock('../../lib/supabase', () => ({
    supabase: { rpc: jest.fn() },
}));

const rpcMock = supabase.rpc as jest.Mock;

describe('referral.service', () => {
    beforeEach(() => {
        rpcMock.mockReset();
    });

    it('maps get_my_referral_status payload', async () => {
        rpcMock.mockResolvedValue({
            data: {
                invite_token: 'ref_tok_1',
                rewards: [{ referee_id: 'u2', status: 'qualified', qualified_at: null, rewarded_at: null }],
                rewards_this_year: 1,
                annual_cap: 12,
            },
            error: null,
        });

        const status = await fetchMyReferralStatus();
        expect(status).toEqual({
            inviteToken: 'ref_tok_1',
            rewards: [
                { referee_id: 'u2', status: 'qualified', qualified_at: null, rewarded_at: null },
            ],
            rewardsThisYear: 1,
            annualCap: 12,
        });
    });

    it('referralInviteUrl uses friend invite path', () => {
        expect(referralInviteUrl('tok')).toBe(buildInviteUrl('friend', 'tok'));
    });
});
