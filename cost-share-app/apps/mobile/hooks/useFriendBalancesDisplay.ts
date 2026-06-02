import { useMemo } from 'react';
import {
    friendBalanceRows,
    FriendBalance,
    FriendBalanceDisplay,
    resolveFriendDisplayBalance,
} from '@cost-share/shared';

export function useFriendBalancesDisplay(
    friends: FriendBalance[] | undefined,
    defaultCurrency: string | undefined,
    rates: Record<string, number> | undefined,
): Map<string, FriendBalanceDisplay> {
    const base = defaultCurrency ?? 'ILS';

    return useMemo(() => {
        const map = new Map<string, FriendBalanceDisplay>();
        if (!friends?.length) return map;

        for (const friend of friends) {
            const rows = friendBalanceRows(friend);
            const display = resolveFriendDisplayBalance(rows, base, rates);
            map.set(friend.userId, display);
        }
        return map;
    }, [friends, base, rates]);
}
