import { addGuestGroupMember } from '../../services/groups.service';
import { supabase } from '../../lib/supabase';

const mockRpc = jest.fn();
const mockMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });

jest.mock('../../lib/supabase', () => ({
    supabase: {
        rpc: (...args: unknown[]) => mockRpc(...args),
        from: jest.fn(() => ({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: (...args: unknown[]) => mockMaybeSingle(...args),
        })),
    },
}));

jest.mock('../../lib/appToast', () => ({
    showSuccessMessage: jest.fn(),
}));

jest.mock('../../lib/handleError', () => ({
    handleError: jest.fn(),
}));

describe('groups.service guest members', () => {
    beforeEach(() => {
        mockRpc.mockReset();
        mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    });

    it('addGuestGroupMember returns guest user id from RPC', async () => {
        mockRpc.mockResolvedValue({
            data: { ok: true, guest_user_id: 'guest-uuid', display_name: 'Charlie' },
            error: null,
        });

        const result = await addGuestGroupMember('group-1', 'Charlie');
        expect(mockRpc).toHaveBeenCalledWith('add_guest_group_member', {
            p_group_id: 'group-1',
            p_display_name: 'Charlie',
        });
        expect(result).toEqual({ userId: 'guest-uuid', displayName: 'Charlie' });
    });

    it('addGuestGroupMember returns null on RPC error', async () => {
        mockRpc.mockResolvedValue({ data: null, error: { message: 'denied' } });
        expect(await addGuestGroupMember('group-1', 'Charlie')).toBeNull();
    });
});
