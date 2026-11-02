import { exportGroupPdf } from '../../services/group-share.service';
import { supabase } from '../../lib/supabase';
import type { Group } from '@cost-share/shared';

jest.mock('../../lib/supabase', () => ({
    supabase: { rpc: jest.fn() },
}));

jest.mock('../../lib/groupExportPdf', () => ({
    printGroupExportPdf: jest.fn(),
}));

jest.mock('expo-sharing', () => ({
    isAvailableAsync: jest.fn().mockResolvedValue(true),
    shareAsync: jest.fn(),
}));

jest.mock('../../lib/appToast', () => ({
    showErrorToast: jest.fn(),
    showSuccessMessage: jest.fn(),
}));

const mockRpc = supabase.rpc as jest.Mock;

const group: Group = {
    id: 'g-pro',
    name: 'Test',
    groupType: 'trip',
    defaultCurrency: 'USD',
    inviteToken: 'tok1234567',
    createdBy: 'u1',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
};

describe('exportGroupPdf Pro gate', () => {
    beforeEach(() => {
        mockRpc.mockReset();
    });

    it('blocks export when require_pro_for_group_export fails with pro_required', async () => {
        mockRpc.mockResolvedValue({ error: { message: 'pro_required' } });
        const ok = await exportGroupPdf(group, { feed: [], debts: [], members: [] });
        expect(ok).toBe(false);
        expect(mockRpc).toHaveBeenCalledWith('require_pro_for_group_export', {
            p_group_id: 'g-pro',
        });
    });
});
