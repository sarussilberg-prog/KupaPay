import type {
    NetByUserCurrency,
    PairwiseDebt,
    SimExpense,
    SimMember,
    SimSettlement,
    SimSplit,
} from './types';

function toCents(n: number): number {
    return Math.round(n * 100);
}

function fromCents(cents: number): number {
    return Number((cents / 100).toFixed(2));
}

function activeUserIds(members: SimMember[]): string[] {
    return members.filter(m => m.isActive).map(m => m.userId);
}

/**
 * Independent oracle: per (active user, currency) net balance from raw ledger rows.
 * Matches get_user_simplified_inputs net formula (before omitting zero currencies).
 */
export function referenceNets(args: {
    members: SimMember[];
    expenses: SimExpense[];
    splits: SimSplit[];
    settlements: SimSettlement[];
}): NetByUserCurrency[] {
    const { members, expenses, splits, settlements } = args;
    const active = new Set(activeUserIds(members));
    const expenseById = new Map<string, SimExpense>();
    for (const e of expenses) {
        if (!e.isDeleted) expenseById.set(e.id, e);
    }

    const acc = new Map<string, Map<string, { paid: number; owed: number; sp: number; sr: number }>>();

    const ensure = (uid: string, currency: string) => {
        let perUser = acc.get(uid);
        if (!perUser) {
            perUser = new Map();
            acc.set(uid, perUser);
        }
        let row = perUser.get(currency);
        if (!row) {
            row = { paid: 0, owed: 0, sp: 0, sr: 0 };
            perUser.set(currency, row);
        }
        return row;
    };

    for (const e of expenseById.values()) {
        ensure(e.paidBy, e.currency).paid += toCents(e.amount);
    }

    for (const s of splits) {
        const exp = expenseById.get(s.expenseId);
        if (!exp) continue;
        ensure(s.userId, exp.currency).owed += toCents(s.amount);
    }

    for (const st of settlements) {
        if (st.deletedAt) continue;
        ensure(st.fromUserId, st.currency).sp += toCents(st.amount);
        ensure(st.toUserId, st.currency).sr += toCents(st.amount);
    }

    const currencies = new Set<string>();
    for (const per of acc.values()) {
        for (const c of per.keys()) currencies.add(c);
    }

    const out: NetByUserCurrency[] = [];
    for (const uid of active) {
        for (const currency of currencies) {
            const row = acc.get(uid)?.get(currency);
            if (!row) continue;
            const netCents = row.paid - row.owed + row.sp - row.sr;
            if (
                row.paid === 0 &&
                row.owed === 0 &&
                row.sp === 0 &&
                row.sr === 0
            ) {
                continue;
            }
            out.push({ userId: uid, currency, net: fromCents(netCents) });
        }
    }
    out.sort((a, b) =>
        a.userId === b.userId
            ? a.currency.localeCompare(b.currency)
            : a.userId.localeCompare(b.userId),
    );
    return out;
}

/** Nets for every user with ledger activity (incl. inactive members). */
export function referenceAllUserNets(args: {
    members: SimMember[];
    expenses: SimExpense[];
    splits: SimSplit[];
    settlements: SimSettlement[];
}): NetByUserCurrency[] {
    const { members, expenses, splits, settlements } = args;
    const memberIds = new Set(members.map(m => m.userId));
    const expenseById = new Map<string, SimExpense>();
    for (const e of expenses) {
        if (!e.isDeleted) expenseById.set(e.id, e);
    }

    const acc = new Map<string, Map<string, { paid: number; owed: number; sp: number; sr: number }>>();
    const ensure = (uid: string, currency: string) => {
        let perUser = acc.get(uid);
        if (!perUser) {
            perUser = new Map();
            acc.set(uid, perUser);
        }
        let row = perUser.get(currency);
        if (!row) {
            row = { paid: 0, owed: 0, sp: 0, sr: 0 };
            perUser.set(currency, row);
        }
        return row;
    };

    for (const e of expenseById.values()) {
        ensure(e.paidBy, e.currency).paid += toCents(e.amount);
    }
    for (const s of splits) {
        const exp = expenseById.get(s.expenseId);
        if (!exp) continue;
        ensure(s.userId, exp.currency).owed += toCents(s.amount);
    }
    for (const st of settlements) {
        if (st.deletedAt) continue;
        ensure(st.fromUserId, st.currency).sp += toCents(st.amount);
        ensure(st.toUserId, st.currency).sr += toCents(st.amount);
    }

    const out: NetByUserCurrency[] = [];
    for (const uid of memberIds) {
        const per = acc.get(uid);
        if (!per) continue;
        for (const [currency, row] of per) {
            const netCents = row.paid - row.owed + row.sp - row.sr;
            if (
                row.paid === 0 &&
                row.owed === 0 &&
                row.sp === 0 &&
                row.sr === 0
            ) {
                continue;
            }
            out.push({ userId: uid, currency, net: fromCents(netCents) });
        }
    }
    return out;
}

/** Sum nets per currency across all members — must be 0 within 1 cent per currency. */
export function referenceNetSumByCurrency(
    nets: NetByUserCurrency[],
): Map<string, number> {
    const sums = new Map<string, number>();
    for (const n of nets) {
        sums.set(n.currency, (sums.get(n.currency) ?? 0) + n.net);
    }
    return sums;
}

function directedKey(debtor: string, creditor: string, currency: string): string {
    return `${debtor}|${creditor}|${currency}`;
}

/**
 * Independent pairwise-debt oracle (mirrors _get_group_pairwise_debts_core semantics).
 * Implemented separately from simplifyDebts to catch drift between SQL and TS.
 */
export function referencePairwiseDebts(args: {
    expenses: SimExpense[];
    splits: SimSplit[];
    settlements: SimSettlement[];
}): PairwiseDebt[] {
    const { expenses, splits, settlements } = args;
    const expenseById = new Map<string, SimExpense>();
    for (const e of expenses) {
        if (!e.isDeleted) expenseById.set(e.id, e);
    }

    const expenseDebts = new Map<string, number>();
    for (const s of splits) {
        const exp = expenseById.get(s.expenseId);
        if (!exp || s.userId === exp.paidBy) continue;
        const key = directedKey(s.userId, exp.paidBy, exp.currency);
        expenseDebts.set(key, (expenseDebts.get(key) ?? 0) + toCents(s.amount));
    }

    const settlementDebts = new Map<string, number>();
    for (const st of settlements) {
        if (st.deletedAt) continue;
        const key = directedKey(st.fromUserId, st.toUserId, st.currency);
        settlementDebts.set(key, (settlementDebts.get(key) ?? 0) + toCents(st.amount));
    }

    const combos = new Set<string>();
    for (const key of expenseDebts.keys()) {
        const [d, c, cur] = key.split('|');
        combos.add(directedKey(d!, c!, cur!));
        combos.add(directedKey(c!, d!, cur!));
    }
    for (const key of settlementDebts.keys()) {
        const [d, c, cur] = key.split('|');
        combos.add(directedKey(d!, c!, cur!));
        combos.add(directedKey(c!, d!, cur!));
    }

    const loHiNet = new Map<string, number>();
    for (const key of combos) {
        const [debtor, creditor, currency] = key.split('|');
        const grossCents =
            (expenseDebts.get(key) ?? 0) - (settlementDebts.get(key) ?? 0);
        const lo = debtor! < creditor! ? debtor! : creditor!;
        const hi = debtor! < creditor! ? creditor! : debtor!;
        const bucket = `${lo}|${hi}|${currency}`;
        const signed = debtor! < creditor! ? grossCents : -grossCents;
        loHiNet.set(bucket, (loHiNet.get(bucket) ?? 0) + signed);
    }

    const debts: PairwiseDebt[] = [];
    for (const [bucket, loToHiCents] of loHiNet) {
        if (Math.abs(loToHiCents) < 1) continue;
        const [lo, hi, currency] = bucket.split('|');
        const amount = fromCents(Math.abs(loToHiCents));
        if (amount < 0.01) continue;
        if (loToHiCents > 0) {
            debts.push({ fromUserId: lo!, toUserId: hi!, currency: currency!, amount });
        } else {
            debts.push({ fromUserId: hi!, toUserId: lo!, currency: currency!, amount });
        }
    }

    debts.sort((x, y) => {
        if (x.fromUserId !== y.fromUserId) return x.fromUserId.localeCompare(y.fromUserId);
        if (x.toUserId !== y.toUserId) return x.toUserId.localeCompare(y.toUserId);
        return x.currency.localeCompare(y.currency);
    });
    return debts;
}

export function netsMap(nets: NetByUserCurrency[]): Map<string, number> {
    const m = new Map<string, number>();
    for (const n of nets) {
        m.set(`${n.userId}|${n.currency}`, n.net);
    }
    return m;
}

export function pairwiseKey(d: PairwiseDebt): string {
    return `${d.fromUserId}|${d.toUserId}|${d.currency}|${d.amount.toFixed(2)}`;
}
