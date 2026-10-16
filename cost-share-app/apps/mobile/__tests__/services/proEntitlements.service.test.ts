import { parseProStatusRpcRow } from '../../services/proEntitlements.service';

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
