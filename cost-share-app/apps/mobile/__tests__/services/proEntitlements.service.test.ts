import {
    fetchMyProStatus,
    fetchMyProStatusWithStoreSync,
    parseProStatusRpcRow,
} from '../../services/proEntitlements.service';

jest.mock('../../lib/supabase', () => ({
    supabase: {
        rpc: jest.fn(),
    },
}));

jest.mock('../../lib/ascScreenshotDemo', () => ({
    isAscScreenshotDemo: () => false,
}));

jest.mock('../../services/purchases.service', () => ({
    isPurchasesConfigured: jest.fn(),
    waitForPurchasesReady: jest.fn(),
    fetchPurchasesCustomerInfo: jest.fn(),
}));

import { supabase } from '../../lib/supabase';
import {
    fetchPurchasesCustomerInfo,
    isPurchasesConfigured,
    waitForPurchasesReady,
} from '../../services/purchases.service';

const rpcMock = supabase.rpc as jest.Mock;
const purchasesConfiguredMock = isPurchasesConfigured as jest.MockedFunction<
    typeof isPurchasesConfigured
>;
const waitReadyMock = waitForPurchasesReady as jest.MockedFunction<typeof waitForPurchasesReady>;
const customerInfoMock = fetchPurchasesCustomerInfo as jest.MockedFunction<
    typeof fetchPurchasesCustomerInfo
>;

describe('fetchMyProStatusWithStoreSync', () => {
    beforeEach(() => {
        rpcMock.mockReset();
        purchasesConfiguredMock.mockReturnValue(true);
        waitReadyMock.mockResolvedValue(true);
    });

    it('merges RevenueCat pro entitlement when RPC still reports free', async () => {
        rpcMock.mockResolvedValue({
            data: {
                hasPro: false,
                individualProUntil: null,
                groupPassUntil: null,
                adminProViewMode: 'real',
            },
            error: null,
        });
        const until = new Date(Date.now() + 86400000).toISOString();
        customerInfoMock.mockResolvedValue({
            entitlements: { active: { pro: { expirationDate: until } } },
        } as Awaited<ReturnType<typeof fetchPurchasesCustomerInfo>>);

        const status = await fetchMyProStatusWithStoreSync();
        expect(status.hasPro).toBe(true);
        expect(status.individualProUntil).toBe(until);
    });
});

describe('fetchMyProStatus', () => {
    beforeEach(() => {
        rpcMock.mockReset();
    });

    it('throws on RPC error instead of returning hasPro false', async () => {
        rpcMock.mockResolvedValue({ data: null, error: { message: 'timeout' } });
        await expect(fetchMyProStatus()).rejects.toEqual({ message: 'timeout' });
    });
});

describe('parseProStatusRpcRow', () => {
    it('trusts server hasPro false over active timestamps (force_free)', () => {
        const status = parseProStatusRpcRow({
            hasPro: false,
            individualProUntil: new Date(Date.now() + 86400000).toISOString(),
            groupPassUntil: null,
            includedTripPassCredits: 1,
            unassignedTripPassCount: 0,
            adminProViewMode: 'force_free',
        });
        expect(status.hasPro).toBe(false);
        expect(status.adminProViewMode).toBe('force_free');
    });

    it('trusts server hasPro true without timestamps (force_pro)', () => {
        const status = parseProStatusRpcRow({
            hasPro: true,
            individualProUntil: null,
            groupPassUntil: null,
            adminProViewMode: 'force_pro',
            adminProViewExpiresAt: '2030-01-01T00:00:00.000Z',
        });
        expect(status.hasPro).toBe(true);
        expect(status.adminProViewExpiresAt).toBe('2030-01-01T00:00:00.000Z');
    });

    it('falls back to timestamps when hasPro omitted', () => {
        const status = parseProStatusRpcRow({
            groupPassUntil: new Date(Date.now() + 86400000).toISOString(),
            adminProViewMode: 'real',
        });
        expect(status.hasPro).toBe(true);
    });
});
