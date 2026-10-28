const mockRpc = jest.fn();
jest.mock('../../lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a) } }));
const mockHandleError = jest.fn();
jest.mock('../../lib/handleError', () => ({ handleError: (...a: unknown[]) => mockHandleError(...a) }));
jest.mock('../../lib/appToast', () => ({ showSuccessToast: jest.fn() }));

import {
    createConsolidationBatch,
    deleteConsolidationBatch,
    isPermissionError,
} from '../../services/consolidation.service';

const params = {
    groupId: 'g1',
    fromUserId: 'u2',
    toUserId: 'u1',
    paymentCurrency: 'ILS',
    paymentAmount: 10,
    settlementDate: new Date('2026-10-28T00:00:00Z'),
    settlements: [{ currency: 'ILS', amount: 10, exchangeRate: 1, fromUserId: 'u2', toUserId: 'u1' }],
};

describe('consolidation.service error messages (#630)', () => {
    beforeEach(() => {
        mockRpc.mockReset();
        mockHandleError.mockReset();
    });

    it('detects 42501 / 403 as permission errors', () => {
        expect(isPermissionError({ code: '42501' })).toBe(true);
        expect(isPermissionError({ status: 403 })).toBe(true);
        expect(isPermissionError({ code: 'PGRST301' })).toBe(false);
        expect(isPermissionError(new Error('fetch failed'))).toBe(false);
        expect(isPermissionError(null)).toBe(false);
    });

    it('shows the permission message (not network error) when create is rejected with 42501', async () => {
        mockRpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'payer_must_be_caller' } });
        await expect(createConsolidationBatch(params)).resolves.toBeNull();
        expect(mockHandleError.mock.calls[0][1].toast.messageKey).toBe('common.permissionError');
    });

    it('keeps the network message for non-permission failures', async () => {
        mockRpc.mockRejectedValue(new TypeError('Network request failed'));
        await createConsolidationBatch(params);
        expect(mockHandleError.mock.calls[0][1].toast.messageKey).toBe('common.networkError');
    });

    it('maps delete permission failures too', async () => {
        mockRpc.mockResolvedValue({ error: { code: '42501', message: 'nope' } });
        await expect(deleteConsolidationBatch('b1')).resolves.toBe(false);
        expect(mockHandleError.mock.calls[0][1].toast.messageKey).toBe('common.permissionError');
    });
});
