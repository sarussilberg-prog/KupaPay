/**
 * Regression for COPAY-MOBILE-PROD-G: a group invite redeemed twice
 * concurrently (the two effects in useInviteRedemption fire together once
 * `session` flips on after sign-in) issued two parallel `redeem_group_invite`
 * RPCs, racing into a `group_members_group_id_user_id_key` duplicate-key
 * violation. handleInviteLink must dedupe concurrent identical redemptions.
 */
import { handleInviteLink } from '../../services/deepLinks.service';
import { supabase } from '../../lib/supabase';

jest.mock('../../lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));
jest.mock('../../lib/appToast', () => ({
    showAppToast: jest.fn(),
    showInfoToast: jest.fn(),
}));
jest.mock('../../lib/handleError', () => ({ handleError: jest.fn() }));
jest.mock('../../store', () => ({
    useAppStore: { getState: () => ({ setPendingNavigation: jest.fn() }) },
}));

describe('handleInviteLink concurrency dedup', () => {
    beforeEach(() => jest.clearAllMocks());

    it('issues a single redeem RPC when the same group invite is redeemed concurrently', async () => {
        let resolveRpc!: (v: unknown) => void;
        const rpcPromise = new Promise((res) => {
            resolveRpc = res;
        });
        (supabase.rpc as jest.Mock).mockReturnValue(rpcPromise);

        const link = { kind: 'group', token: 'XYZ9876543' } as const;
        const queryClient = { invalidateQueries: jest.fn() } as never;

        // Both effects fire before the first RPC resolves.
        const p1 = handleInviteLink(link, null, queryClient);
        const p2 = handleInviteLink(link, null, queryClient);

        resolveRpc({
            data: { group_id: 'g1', group_name: 'G', already_member: false },
            error: null,
        });
        await Promise.all([p1, p2]);

        expect(supabase.rpc).toHaveBeenCalledTimes(1);
        expect(supabase.rpc).toHaveBeenCalledWith('redeem_group_invite', {
            p_token: 'XYZ9876543',
        });
    });
});
