import {
    BalanceSummary,
    FriendBalanceSummary,
    GroupRollup,
    SimplifiedDebts,
    SimplifiedInputsPayload,
    Transfer,
    UnbalancedLedgerEntry,
} from '../types';
import { simplifyDebts, UnbalancedLedgerError } from './simplifyDebts';

/**
 * Derive the canonical SimplifiedDebts struct from the RPC payload.
 *
 * For every (group, currency), run simplifyDebts to produce a minimal set of
 * transfers. Concatenate, then project into views for each UI surface. Each
 * view is a pure projection of `transfers` plus `currentUserId` — never a
 * recalculation from raw nets. This is the structural guarantee that every
 * surface agrees with the settle-up screen.
 */
export function deriveSimplifiedDebts(
    payload: SimplifiedInputsPayload,
    currentUserId: string,
): SimplifiedDebts {
    const transfers: Transfer[] = [];
    const unbalanced: UnbalancedLedgerEntry[] = [];

    for (const group of payload.groups) {
        const nameById = new Map<string, string>(
            group.members.map(m => [m.userId, m.name ?? '']),
        );
        for (const cur of group.currencies) {
            const balances = cur.nets.map(n => ({
                groupId: group.groupId,
                userId: n.userId,
                currency: cur.currency,
                totalPaid: 0,
                totalOwed: 0,
                totalSettledPaid: 0,
                totalSettledReceived: 0,
                netBalance: n.net,
            }));
            try {
                const result = simplifyDebts(balances, nameById);
                for (const d of result.debts) {
                    transfers.push({
                        groupId: group.groupId,
                        currency: d.currency,
                        fromUserId: d.fromUserId,
                        toUserId: d.toUserId,
                        amount: d.amount,
                    });
                }
            } catch (err) {
                // The ledger for this currency does not sum to zero. With the
                // canonical RPC now emitting a net for EVERY footprint user
                // (incl. inactive/deleted members), the only remaining cause is
                // genuine upstream corruption — e.g. an expense whose splits
                // don't add up to its amount. Surface it instead of silently
                // dropping the currency, which would re-introduce the
                // "you are owed X / everyone settled" contradiction.
                if (err instanceof UnbalancedLedgerError) {
                    unbalanced.push({
                        groupId: group.groupId,
                        currency: cur.currency,
                        residual: round2(
                            cur.nets.reduce((sum, n) => sum + n.net, 0),
                        ),
                    });
                    continue;
                }
                throw err;
            }
        }
    }

    return {
        transfers,
        byGroupCurrency: buildByGroupCurrency(transfers),
        userTransfers: transfers.filter(
            t => t.fromUserId === currentUserId || t.toUserId === currentUserId,
        ),
        groupRollups: buildGroupRollups(transfers, currentUserId),
        friendBalances: buildFriendBalances(transfers, payload, currentUserId),
        unbalanced,
    };
}

function buildByGroupCurrency(
    transfers: Transfer[],
): Map<string, Map<string, Transfer[]>> {
    const out = new Map<string, Map<string, Transfer[]>>();
    for (const t of transfers) {
        let perGroup = out.get(t.groupId);
        if (!perGroup) {
            perGroup = new Map();
            out.set(t.groupId, perGroup);
        }
        const list = perGroup.get(t.currency) ?? [];
        list.push(t);
        perGroup.set(t.currency, list);
    }
    return out;
}

function buildGroupRollups(
    transfers: Transfer[],
    currentUserId: string,
): Map<string, GroupRollup> {
    const netByGroupCurrency = new Map<string, Map<string, number>>();
    for (const t of transfers) {
        const sign =
            t.toUserId === currentUserId
                ? 1
                : t.fromUserId === currentUserId
                  ? -1
                  : 0;
        if (sign === 0) continue;
        let per = netByGroupCurrency.get(t.groupId);
        if (!per) {
            per = new Map();
            netByGroupCurrency.set(t.groupId, per);
        }
        per.set(t.currency, (per.get(t.currency) ?? 0) + sign * t.amount);
    }
    const rollups = new Map<string, GroupRollup>();
    netByGroupCurrency.forEach((per, groupId) => {
        const entries = [...per.entries()]
            .map(([currency, net]) => ({ currency, net: round2(net) }))
            .filter(e => Math.abs(e.net) >= 0.01);
        if (entries.length === 0) return;
        entries.sort(
            (a, b) =>
                Math.abs(b.net) - Math.abs(a.net) ||
                a.currency.localeCompare(b.currency),
        );
        const [primary, ...others] = entries;
        rollups.set(groupId, { groupId, primary, others });
    });
    return rollups;
}

function buildFriendBalances(
    transfers: Transfer[],
    payload: SimplifiedInputsPayload,
    currentUserId: string,
): Map<string, FriendBalanceSummary> {
    const netByFriendCurrency = new Map<string, Map<string, number>>();
    const sharedGroupsByFriend = new Map<string, Set<string>>();

    for (const t of transfers) {
        const involvesMe =
            t.fromUserId === currentUserId || t.toUserId === currentUserId;
        if (!involvesMe) continue;
        const friend =
            t.fromUserId === currentUserId ? t.toUserId : t.fromUserId;
        const sign = t.toUserId === currentUserId ? 1 : -1;
        let per = netByFriendCurrency.get(friend);
        if (!per) {
            per = new Map();
            netByFriendCurrency.set(friend, per);
        }
        per.set(t.currency, (per.get(t.currency) ?? 0) + sign * t.amount);
        let gs = sharedGroupsByFriend.get(friend);
        if (!gs) {
            gs = new Set();
            sharedGroupsByFriend.set(friend, gs);
        }
        gs.add(t.groupId);
    }

    const profileById = new Map<
        string,
        { name: string | null; avatarUrl: string | null }
    >();
    for (const g of payload.groups) {
        for (const m of g.members) {
            if (!profileById.has(m.userId)) {
                profileById.set(m.userId, {
                    name: m.name,
                    avatarUrl: m.avatarUrl,
                });
            }
        }
    }

    const out = new Map<string, FriendBalanceSummary>();
    netByFriendCurrency.forEach((per, friendId) => {
        const byCurrency = [...per.entries()]
            .map(([currency, net]) => ({ currency, net: round2(net) }))
            .filter(e => Math.abs(e.net) >= 0.01)
            .sort((a, b) => a.currency.localeCompare(b.currency));
        if (byCurrency.length === 0) return;
        const profile = profileById.get(friendId) ?? {
            name: friendId,
            avatarUrl: null,
        };
        // A null name means the RPC returned an anonymised (deleted) account.
        // Flag it isActive:false so getDisplayNameForFriend renders "deleted
        // user"; keep `name` a non-null string so sorts/labels never crash.
        const isActive = profile.name != null;
        out.set(friendId, {
            userId: friendId,
            name: profile.name ?? '',
            avatarUrl: profile.avatarUrl,
            isActive,
            sharedGroupIds: [...(sharedGroupsByFriend.get(friendId) ?? [])].sort(
                (a, b) => a.localeCompare(b),
            ),
            byCurrency,
        });
    });
    return out;
}

function round2(n: number): number {
    return Number(n.toFixed(2));
}

/**
 * Derive the profile-screen BalanceSummary shape from canonical user transfers.
 *
 * For each currency the user has at least one transfer in:
 *   owed       = Σ amount where user is fromUserId (i.e. user owes)
 *   owedToUser = Σ amount where user is toUserId   (i.e. user is owed)
 *
 * The totalOwed / totalOwedToUser scalars are intentionally null; the profile
 * hook (`useProfileBalanceSummary`) re-derives them in the user's default
 * currency with FX so the displayed amount + currency tag stay in lockstep.
 */
export function deriveBalanceSummary(
    simplified: SimplifiedDebts,
    currentUserId: string,
    defaultCurrency: string,
): BalanceSummary {
    const owedByCurrency = new Map<string, number>();
    const owedToUserByCurrency = new Map<string, number>();
    for (const t of simplified.userTransfers) {
        if (t.fromUserId === currentUserId) {
            owedByCurrency.set(
                t.currency,
                (owedByCurrency.get(t.currency) ?? 0) + t.amount,
            );
        } else if (t.toUserId === currentUserId) {
            owedToUserByCurrency.set(
                t.currency,
                (owedToUserByCurrency.get(t.currency) ?? 0) + t.amount,
            );
        }
    }
    const currencies = new Set([
        ...owedByCurrency.keys(),
        ...owedToUserByCurrency.keys(),
    ]);
    const byCurrency = [...currencies]
        .map(currency => ({
            currency,
            owed: round2(owedByCurrency.get(currency) ?? 0),
            owedToUser: round2(owedToUserByCurrency.get(currency) ?? 0),
        }))
        .filter(r => r.owed >= 0.01 || r.owedToUser >= 0.01)
        .sort((a, b) => a.currency.localeCompare(b.currency));
    return {
        totalOwed: null,
        totalOwedToUser: null,
        defaultCurrency,
        byCurrency,
    };
}
