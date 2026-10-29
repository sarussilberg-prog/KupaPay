import {
    calculateUserBalancesByCurrencyFromData,
    deriveSimplifiedDebts,
    simplifyDebts,
} from '../index';
import {
    netsMap,
    referenceAllUserNets,
    referenceNetSumByCurrency,
    referenceNets,
} from './referenceModel';
import type { SimulationState } from './types';

const MAX_DRIFT = 0.01;

function round2(n: number): number {
    return Number(n.toFixed(2));
}

function activeUserIds(state: SimulationState): string[] {
    return state.members.filter(m => m.isActive).map(m => m.userId);
}

function liveExpenses(state: SimulationState) {
    return state.expenses
        .filter(e => !e.isDeleted)
        .map(e => ({
            id: e.id,
            paidBy: e.paidBy,
            amount: e.amount,
            currency: e.currency,
        }));
}

function liveSettlements(state: SimulationState) {
    return state.settlements
        .filter(s => !s.deletedAt)
        .map(s => ({
            fromUserId: s.fromUserId,
            toUserId: s.toUserId,
            amount: s.amount,
            currency: s.currency,
        }));
}

export function assertLedgerInvariants(state: SimulationState): void {
    const refNets = referenceNets(state);
    const allNets = referenceAllUserNets(state);
    const sums = referenceNetSumByCurrency(allNets);
    for (const [currency, sum] of sums) {
        if (Math.abs(round2(sum)) > MAX_DRIFT) {
            throw new Error(
                `Ledger nets do not sum to zero for ${currency}: ${round2(sum)}`,
            );
        }
    }

    const clientBalances = calculateUserBalancesByCurrencyFromData({
        groupId: state.groupId,
        userIds: activeUserIds(state),
        expenses: liveExpenses(state),
        splits: state.splits.filter(s => {
            const exp = state.expenses.find(e => e.id === s.expenseId);
            return exp && !exp.isDeleted;
        }),
        settlements: liveSettlements(state),
    });

    const clientNets: { userId: string; currency: string; net: number }[] = [];
    for (const row of clientBalances) {
        for (const c of row.byCurrency) {
            clientNets.push({
                userId: row.userId,
                currency: c.currency,
                net: c.netBalance,
            });
        }
    }

    const refMap = netsMap(refNets);
    for (const cn of clientNets) {
        const key = `${cn.userId}|${cn.currency}`;
        const ref = refMap.get(key) ?? 0;
        if (Math.abs(round2(cn.net - ref)) > MAX_DRIFT) {
            throw new Error(
                `Client net drift for ${key}: client=${cn.net} ref=${ref}`,
            );
        }
    }
    for (const [key, ref] of refMap) {
        const client = clientNets.find(n => `${n.userId}|${n.currency}` === key);
        const clientNet = client?.net ?? 0;
        if (Math.abs(round2(clientNet - ref)) > MAX_DRIFT) {
            throw new Error(
                `Missing client net for ${key}: client=${clientNet} ref=${ref}`,
            );
        }
    }

    const payload = {
        groups: [
            {
                groupId: state.groupId,
                members: activeUserIds(state).map(userId => ({
                    userId,
                    name: userId,
                    avatarUrl: null as string | null,
                })),
                currencies: [...new Set(refNets.map(n => n.currency))].map(currency => ({
                    currency,
                    nets: refNets
                        .filter(n => n.currency === currency)
                        .map(n => ({ userId: n.userId, net: n.net })),
                })),
            },
        ],
    };

    const simplified = deriveSimplifiedDebts(payload, activeUserIds(state)[0] ?? 'u_0');
    if (simplified.unbalanced.length > 0) {
        const u = simplified.unbalanced[0]!;
        throw new Error(
            `deriveSimplifiedDebts marked unbalanced ${u.groupId}/${u.currency}: residual ${u.residual}`,
        );
    }

    for (const currency of [...sums.keys()]) {
        const balancesForCurrency = clientBalances.flatMap(b =>
            b.byCurrency
                .filter(c => c.currency === currency)
                .map(c => ({
                    groupId: state.groupId,
                    userId: b.userId,
                    currency,
                    totalPaid: c.totalPaid,
                    totalOwed: c.totalOwed,
                    totalSettledPaid: c.totalSettledPaid,
                    totalSettledReceived: c.totalSettledReceived,
                    netBalance: c.netBalance,
                })),
        );
        if (balancesForCurrency.length === 0) continue;
        const names = new Map(activeUserIds(state).map(id => [id, id]));
        simplifyDebts(balancesForCurrency, names);
    }
}
