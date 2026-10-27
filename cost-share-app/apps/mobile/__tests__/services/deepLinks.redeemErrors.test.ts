import { handleInviteLink } from '../../services/deepLinks.service';
import { supabase } from '../../lib/supabase';
import { showInfoToast } from '../../lib/appToast';
import { handleError } from '../../lib/handleError';

jest.mock('../../lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));
jest.mock('../../lib/appToast', () => ({
    showAppToast: jest.fn(),
    showInfoToast: jest.fn(),
}));
jest.mock('../../lib/handleError', () => ({ handleError: jest.fn() }));
jest.mock('../../store', () => ({
    useAppStore: { getState: () => ({ setPendingNavigation: jest.fn() }) },
}));
jest.mock('../../services/groups.service', () => ({
    listClaimableGuestMembers: jest.fn().mockResolvedValue([]),
}));

describe('handleInviteLink structured RPC errors', () => {
    beforeEach(() => jest.clearAllMocks());

    it('maps invite_not_found from JSON payload', async () => {
        (supabase.rpc as jest.Mock).mockResolvedValue({
            data: { ok: false, error_code: 'invite_not_found' },
            error: null,
        });

        const result = await handleInviteLink(
            { kind: 'group', token: 'badToken12345' },
            null,
            { invalidateQueries: jest.fn() } as never,
        );

        expect(result).toBeNull();
        expect(handleError).toHaveBeenCalled();
        expect(showInfoToast).not.toHaveBeenCalled();
    });

    it('maps cannot_self_invite from JSON payload', async () => {
        (supabase.rpc as jest.Mock).mockResolvedValue({
            data: { ok: false, error_code: 'cannot_self_invite' },
            error: null,
        });

        await handleInviteLink(
            { kind: 'friend', token: 'selfToken12345' },
            null,
            { invalidateQueries: jest.fn() } as never,
        );

        expect(showInfoToast).toHaveBeenCalledWith('invite.redemption.selfInvite');
    });
});
