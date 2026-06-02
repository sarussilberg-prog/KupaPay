const mockRpc = jest.fn();
jest.mock('../../lib/supabase', () => ({
    supabase: { rpc: (...a: any[]) => mockRpc(...a) },
}));

import { listDeletedAccounts, restoreDeletedAccount } from '../../services/admin.service';

beforeEach(() => {
    mockRpc.mockReset();
});

describe('listDeletedAccounts', () => {
    it('returns mapped rows on success', async () => {
        mockRpc.mockResolvedValue({
            data: [
                {
                    user_id: 'u1',
                    email: 'a@test.local',
                    deleted_at: '2026-06-01T10:00:00Z',
                    reason: 'self_service',
                    open_balance_snapshot: { summary: [] },
                    notes: null,
                },
            ],
            error: null,
        });

        const result = await listDeletedAccounts();

        expect(mockRpc).toHaveBeenCalledWith('admin_list_deleted_accounts');
        expect(result).toEqual([
            {
                userId: 'u1',
                email: 'a@test.local',
                deletedAt: new Date('2026-06-01T10:00:00Z'),
                reason: 'self_service',
                openBalanceSnapshot: { summary: [] },
                notes: null,
            },
        ]);
    });

    it('returns empty array on RPC error', async () => {
        mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
        const result = await listDeletedAccounts();
        expect(result).toEqual([]);
    });
});

describe('restoreDeletedAccount', () => {
    it('returns ok on success', async () => {
        mockRpc.mockResolvedValue({ data: null, error: null });
        const result = await restoreDeletedAccount('u1');
        expect(mockRpc).toHaveBeenCalledWith('admin_restore_deleted_account', { p_user_id: 'u1' });
        expect(result).toEqual({ ok: true });
    });

    it('maps not_authorized error to i18n key', async () => {
        mockRpc.mockResolvedValue({ data: null, error: { message: 'not_authorized' } });
        const result = await restoreDeletedAccount('u1');
        expect(result).toEqual({ ok: false, error: 'admin.errors.notAuthorized' });
    });

    it('maps generic error to a generic i18n key', async () => {
        mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
        const result = await restoreDeletedAccount('u1');
        expect(result).toEqual({ ok: false, error: 'admin.deletedUsers.restoreError' });
    });
});
