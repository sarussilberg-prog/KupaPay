const mockRpc = jest.fn();
const mockInvoke = jest.fn();

jest.mock('../../lib/supabase', () => ({
    supabase: {
        rpc: (...args: unknown[]) => mockRpc(...args),
        functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
    },
}));

import { redeemKupaPayPromoCode } from '../../services/promoCode.service';

describe('redeemKupaPayPromoCode', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });
    });

    it('returns invalid for short codes without RPC', async () => {
        const result = await redeemKupaPayPromoCode('ab');
        expect(result).toEqual({ ok: false, code: 'promo_invalid' });
        expect(mockRpc).not.toHaveBeenCalled();
    });

    it('invokes RC sync after successful redeem', async () => {
        mockRpc.mockResolvedValue({
            data: {
                ok: true,
                redemption_id: 'red-1',
                pro_until: '2026-11-01T00:00:00Z',
                duration_days: 14,
            },
            error: null,
        });

        const result = await redeemKupaPayPromoCode('SUMMER');
        expect(result.ok).toBe(true);
        expect(mockInvoke).toHaveBeenCalledWith('promo-code-redeem', {
            body: { redemption_id: 'red-1' },
        });
    });

    it('maps already redeemed errors', async () => {
        mockRpc.mockResolvedValue({
            data: null,
            error: { message: 'promo_already_redeemed' },
        });
        const result = await redeemKupaPayPromoCode('SUMMER');
        expect(result).toEqual({ ok: false, code: 'promo_already_redeemed' });
    });
});
