import type { PairwiseDebt } from '@cost-share/shared';

export interface ConvertedTripDebt {
    fromUserId: string;
    toUserId: string;
    originalCurrency: string;
    originalAmount: number;
    convertedAmount: number;
    targetCurrency: string;
    exchangeRate: number;
}

/**
 * Converts each pairwise debt leg into a target trip currency using supplied rates
 * (1 unit of `fromCurrency` = rates[fromCurrency] in target terms when base is target).
 */
export function convertDebtsToTripCurrency(
    debts: PairwiseDebt[],
    targetCurrency: string,
    ratesFromTarget: Record<string, number> | null,
): ConvertedTripDebt[] {
    if (!ratesFromTarget) return [];
    const out: ConvertedTripDebt[] = [];
    for (const d of debts) {
        const cur = d.currency;
        let rate = 1;
        if (cur !== targetCurrency) {
            const r = ratesFromTarget[cur];
            if (r == null || r <= 0) continue;
            rate = 1 / r;
        }
        out.push({
            fromUserId: d.fromUserId,
            toUserId: d.toUserId,
            originalCurrency: cur,
            originalAmount: d.amount,
            convertedAmount: Number((d.amount * rate).toFixed(2)),
            targetCurrency,
            exchangeRate: rate,
        });
    }
    return out;
}
