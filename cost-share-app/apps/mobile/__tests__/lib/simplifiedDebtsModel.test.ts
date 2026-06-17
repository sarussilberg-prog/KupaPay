import { deriveSimplifiedDebts } from '@cost-share/shared';
import { all_settled, ARI } from './fixtures/simplifiedInputs';

describe('deriveSimplifiedDebts', () => {
    it('all_settled — every view is empty', () => {
        const d = deriveSimplifiedDebts(all_settled, ARI);
        expect(d.transfers).toEqual([]);
        expect(d.userTransfers).toEqual([]);
        expect(d.byGroupCurrency.size).toBe(0);
        expect(d.groupRollups.size).toBe(0);
        expect(d.friendBalances.size).toBe(0);
    });
});
