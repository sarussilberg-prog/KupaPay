import { supabase } from '../../lib/supabase';
import {
    addGuestGroupMember,
    claimGuestGroupMember,
} from '../../services/groups.service';

jest.mock('../../lib/supabase', () => ({
    supabase: { rpc: jest.fn(), from: jest.fn() },
}));

jest.mock('../../lib/queryClient', () => ({
    queryClient: { invalidateQueries: jest.fn(), setQueryData: jest.fn() },
}));

jest.mock('../../lib/appToast', () => ({
    showSuccessMessage: jest.fn(),
}));

jest.mock('../../lib/handleError', () => ({
    handleError: jest.fn(),
}));

jest.mock('../../lib/invalidateBalanceCaches', () => ({
    invalidateBalanceCaches: jest.fn(),
}));

describe('guest group members (#395)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        const chain = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
        (supabase.from as jest.Mock).mockReturnValue(chain);
    });

    it('addGuestGroupMember returns guest id on success', async () => {
        (supabase.rpc as jest.Mock).mockResolvedValue({
            data: { ok: true, guest_user_id: 'g1', display_name: 'Sam' },
            error: null,
        });
        const result = await addGuestGroupMember('grp', 'Sam');
        expect(result).toEqual({ userId: 'g1', displayName: 'Sam' });
    });

    it('claimGuestGroupMember returns true when RPC ok', async () => {
        (supabase.rpc as jest.Mock).mockResolvedValue({ data: { ok: true }, error: null });
        await expect(claimGuestGroupMember('grp', 'guest')).resolves.toBe(true);
    });
});
