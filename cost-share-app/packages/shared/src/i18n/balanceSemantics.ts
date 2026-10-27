import { wrapLtrForBidi } from './formatMoney';

export type UserBalanceTone = 'settled' | 'owe' | 'owed' | 'unknown';

const SETTLED_EPSILON = 0.01;

/** Classify the current user's signed net balance for UI tone and copy. */
export function classifyUserNetBalance(net: number | undefined | null): UserBalanceTone {
    if (net === undefined || net === null || !Number.isFinite(net)) return 'unknown';
    if (Math.abs(net) < SETTLED_EPSILON) return 'settled';
    return net > 0 ? 'owed' : 'owe';
}

/** i18n keys for group-card / list balance chips (mobile bundles). */
export function balanceChipLabelKey(
    tone: UserBalanceTone,
    groupHasOpenDebts?: boolean,
): string {
    if (tone === 'settled') {
        return groupHasOpenDebts ? 'groups.card.youSettled' : 'groups.card.settled';
    }
    if (tone === 'owed') return 'groups.card.owedToYouCaption';
    if (tone === 'owe') return 'groups.card.youOweCaption';
    return 'groups.card.balanceUnavailable';
}

export function countNonZeroCurrencyOthers(
    others: { currency: string; net: number }[] | undefined,
    primaryCurrency?: string,
): number {
    return (others ?? []).filter(o => {
        if (Math.abs(o.net) < SETTLED_EPSILON) return false;
        if (primaryCurrency && o.currency === primaryCurrency) return false;
        return true;
    }).length;
}

/** Chip / link hint: "+2 currencies" with LTR-isolated "+N" for RTL UI. */
export function formatExtraCurrenciesChipLabel(count: number, currencyWord: string): string {
    if (count <= 0 || !currencyWord.trim()) return '';
    return `${wrapLtrForBidi(`+${count}`)} ${currencyWord.trim()}`;
}
