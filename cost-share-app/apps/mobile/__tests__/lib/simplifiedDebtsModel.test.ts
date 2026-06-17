import { deriveSimplifiedDebts } from '@cost-share/shared';
import {
    all_settled,
    cycle_blala,
    residual_paris,
    multi_currency_blala,
    multi_group,
    ARI,
    BAR,
    NAVEH,
    SARUS,
    BLALA,
    PARIS,
} from '../../__fixtures__/simplifiedInputs';

describe('deriveSimplifiedDebts', () => {
    describe('all_settled', () => {
        it('every view is empty', () => {
            const d = deriveSimplifiedDebts(all_settled, ARI);
            expect(d.transfers).toEqual([]);
            expect(d.userTransfers).toEqual([]);
            expect(d.byGroupCurrency.size).toBe(0);
            expect(d.groupRollups.size).toBe(0);
            expect(d.friendBalances.size).toBe(0);
        });
    });

    describe('cycle_blala', () => {
        it('a perfect 3-way cycle collapses to zero transfers', () => {
            const d = deriveSimplifiedDebts(cycle_blala, ARI);
            expect(d.transfers).toEqual([]);
        });

        it('groupRollups omits the group when all nets are zero', () => {
            const d = deriveSimplifiedDebts(cycle_blala, ARI);
            expect(d.groupRollups.get(BLALA)).toBeUndefined();
        });

        it('friendBalances omits both counterparties (no real debt)', () => {
            const d = deriveSimplifiedDebts(cycle_blala, ARI);
            expect(d.friendBalances.get(BAR)).toBeUndefined();
            expect(d.friendBalances.get(NAVEH)).toBeUndefined();
        });

        it('byGroupCurrency omits the group (no transfers in any currency)', () => {
            const d = deriveSimplifiedDebts(cycle_blala, ARI);
            expect(d.byGroupCurrency.get(BLALA)).toBeUndefined();
        });
    });

    describe('residual_paris', () => {
        // Sarus paid 44 split 14.66/14.68/14.66. From Sarus's POV he is owed
        // 29.34 (= 14.68 + 14.66). Header used to show only 14.68 (the largest
        // pair). This fixture pins the rollup to the SUM, not the max pair.

        it('produces two transfers, both toward Sarus', () => {
            const d = deriveSimplifiedDebts(residual_paris, SARUS);
            expect(d.transfers).toHaveLength(2);
            expect(d.transfers.every(t => t.toUserId === SARUS)).toBe(true);
        });

        it("rollups for Sarus show ILS +29.34 (not 14.68)", () => {
            const d = deriveSimplifiedDebts(residual_paris, SARUS);
            const rollup = d.groupRollups.get(PARIS);
            expect(rollup?.primary).toEqual({ currency: 'ILS', net: 29.34 });
            expect(rollup?.others).toEqual([]);
        });

        it("rollups for Ari show ILS -14.68", () => {
            const d = deriveSimplifiedDebts(residual_paris, ARI);
            const rollup = d.groupRollups.get(PARIS);
            expect(rollup?.primary).toEqual({ currency: 'ILS', net: -14.68 });
        });

        it("Sarus's friend balances show Ari +14.68 and Naveh +14.66", () => {
            const d = deriveSimplifiedDebts(residual_paris, SARUS);
            expect(d.friendBalances.get(ARI)?.byCurrency).toEqual([
                { currency: 'ILS', net: 14.68 },
            ]);
            expect(d.friendBalances.get(NAVEH)?.byCurrency).toEqual([
                { currency: 'ILS', net: 14.66 },
            ]);
        });
    });

    describe('multi_currency_blala', () => {
        it('IRR cycle cancels but USD residuals produce 2 transfers', () => {
            const d = deriveSimplifiedDebts(multi_currency_blala, ARI);
            const usdTransfers = d.transfers.filter(t => t.currency === 'USD');
            const irrTransfers = d.transfers.filter(t => t.currency === 'IRR');
            expect(irrTransfers).toEqual([]);
            expect(usdTransfers).toHaveLength(2);
            expect(usdTransfers.every(t => t.toUserId === ARI)).toBe(true);
        });

        it("Ari's rollup primary is USD +6.67, no others", () => {
            const d = deriveSimplifiedDebts(multi_currency_blala, ARI);
            const rollup = d.groupRollups.get(BLALA);
            expect(rollup?.primary).toEqual({ currency: 'USD', net: 6.67 });
            expect(rollup?.others).toEqual([]);
        });

        it("Bar's friend balance with Ari = USD -3.33 (Bar owes Ari)", () => {
            const d = deriveSimplifiedDebts(multi_currency_blala, BAR);
            expect(d.friendBalances.get(ARI)?.byCurrency).toEqual([
                { currency: 'USD', net: -3.33 },
            ]);
        });
    });

    describe('multi_group', () => {
        it("Naveh's sharedGroupIds includes only groups where Naveh transfers with Ari", () => {
            const d = deriveSimplifiedDebts(multi_group, ARI);
            const naveh = d.friendBalances.get(NAVEH);
            expect(naveh?.sharedGroupIds).toEqual([BLALA]);
        });

        it("byCurrency aggregates only currencies with a real Ari↔Naveh transfer", () => {
            const d = deriveSimplifiedDebts(multi_group, ARI);
            const naveh = d.friendBalances.get(NAVEH);
            expect(naveh?.byCurrency).toEqual([{ currency: 'USD', net: 3.34 }]);
        });
    });
});
