const mockRpc = jest.fn();

jest.mock('../../lib/supabase', () => ({
    supabase: {
        rpc: (...args: unknown[]) => mockRpc(...args),
    },
}));

const mockLoad = jest.fn();
const mockPersist = jest.fn();
const mockClear = jest.fn();

jest.mock('../../lib/pendingAmbassadorRefStorage', () => ({
    loadPendingAmbassadorRef: () => mockLoad(),
    persistPendingAmbassadorRef: (code: string) => mockPersist(code),
    clearPendingAmbassadorRef: () => mockClear(),
}));

import {
    captureAmbassadorRefFromUrl,
    claimPendingAmbassadorReferral,
} from '../../services/ambassador.service';

describe('ambassador.service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('captures ref query param from URL', async () => {
        const ok = await captureAmbassadorRefFromUrl('https://kupa-pay.com/en?ref=AMB-ABC123');
        expect(ok).toBe(true);
        expect(mockPersist).toHaveBeenCalledWith('AMB-ABC123');
    });

    it('claims pending ref via RPC', async () => {
        mockLoad.mockResolvedValue('AMB-XYZ789');
        mockRpc.mockResolvedValue({ error: null });
        await claimPendingAmbassadorReferral();
        expect(mockRpc).toHaveBeenCalledWith('attribute_ambassador_referral', {
            p_code: 'AMB-XYZ789',
        });
        expect(mockClear).toHaveBeenCalled();
    });
});
