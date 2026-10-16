const mockRpc = jest.fn();
jest.mock('../../lib/supabase', () => ({
    supabase: { rpc: (...a: any[]) => mockRpc(...a) },
}));

import {
    listDeletedAccounts,
    restoreDeletedAccount,
    fetchAdminPlatformMetrics,
    fetchAdminMonetizationMetrics,
    AdminMonetizationMetricsError,
} from '../../services/admin.service';

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

describe('fetchAdminPlatformMetrics', () => {
    it('maps RPC JSONB to AdminPlatformMetrics', async () => {
        mockRpc.mockResolvedValue({
            data: {
                version: 1,
                generatedAt: '2026-06-02T12:00:00Z',
                users: { registered: 10, deleted: 2 },
                groups: { active: 5, archived: 3, deleted: 1, manualArchiveMemberships: 7 },
            },
            error: null,
        });
        const m = await fetchAdminPlatformMetrics();
        expect(mockRpc).toHaveBeenCalledWith('admin_get_platform_metrics');
        expect(m).toEqual({
            version: 1,
            generatedAt: '2026-06-02T12:00:00Z',
            users: { registered: 10, deleted: 2 },
            groups: { active: 5, archived: 3, deleted: 1, manualArchiveMemberships: 7 },
        });
    });

    it('returns null on RPC error', async () => {
        mockRpc.mockResolvedValue({ data: null, error: { message: 'not_authorized' } });
        expect(await fetchAdminPlatformMetrics()).toBeNull();
    });
});

describe('fetchAdminMonetizationMetrics', () => {
    it('returns parsed metrics on success', async () => {
        mockRpc.mockResolvedValue({
            data: {
                funnel: { ad_gate_shown: 2, ad_gate_watch_tapped: 1, ad_gate_watch_completed: 1, ad_gate_pro_tapped: 0, remind_sent: 0 },
                by_feature: {},
                by_platform: { ios: 2 },
                daily: [],
            },
            error: null,
        });
        const m = await fetchAdminMonetizationMetrics();
        expect(mockRpc).toHaveBeenCalledWith('get_monetization_metrics');
        expect(m.funnel.ad_gate_shown).toBe(2);
    });

    it('throws analytics_unavailable when RPC is missing', async () => {
        mockRpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });
        await expect(fetchAdminMonetizationMetrics()).rejects.toMatchObject({
            code: 'analytics_unavailable',
        });
    });

    it('throws not_admin when RPC rejects admin', async () => {
        mockRpc.mockResolvedValue({ data: null, error: { message: 'not_admin' } });
        await expect(fetchAdminMonetizationMetrics()).rejects.toBeInstanceOf(AdminMonetizationMetricsError);
        await expect(fetchAdminMonetizationMetrics()).rejects.toMatchObject({ code: 'not_admin' });
    });
});
