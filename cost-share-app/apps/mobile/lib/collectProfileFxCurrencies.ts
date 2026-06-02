import {
    BalanceSummary,
    collectFriendFxCurrencies,
    FriendBalance,
} from '@cost-share/shared';

/** Union of foreign currencies needed for profile hero + inline friend balances. */
export function collectProfileFxCurrencies(
    balance: BalanceSummary | undefined,
    friends: FriendBalance[] | undefined,
    baseCurrency: string,
): string[] {
    const set = new Set<string>();

    if (balance) {
        for (const row of balance.byCurrency) {
            if (row.currency !== baseCurrency) set.add(row.currency);
        }
    }

    for (const currency of collectFriendFxCurrencies(friends ?? [], baseCurrency)) {
        set.add(currency);
    }

    return [...set].sort((a, b) => a.localeCompare(b));
}
