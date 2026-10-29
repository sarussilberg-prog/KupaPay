import type {
    NetByUserCurrency,
    PairwiseDebt,
    SimExpense,
    SimMember,
    SimSettlement,
    SimSplit,
} from './types';

type LedgerTotals = { paid: number; owed: number; sp: number; sr: number };
type LedgerAcc = Map<string, Map<string, LedgerTotals>>;

function toCents(n: number): number {
    return Math.round(n * 100);
}

function fromCents(cents: number): number {
    return Number((cents / 100).toFixed(2));
}

function liveExpenseMap(expenses: SimExpense[]): Map<string, SimExpense> {
    const expenseById = new Map<string, SimExpense>();
    for (const e of expenses) {
        if (!e.isDeleted) expenseById.set(e.id, e);
    }
    return expenseById;
}

function accumulateLedger(args: {
    expenses: SimExpense[];
    splits: SimSplit[];
    settlements: SimSettlement[];
}): LedgerAcc {
    const expenseById = liveExpenseMap(args.expenses);
    const acc: LedgerAcc = new Map();

    const ensure = (uid: string, currency: string): LedgerTotals => {
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
    for (const s of args.splits) {
        const exp = expenseById.get(s.expenseId);
        if (!exp) continue;
        ensure(s.userId, exp.currency).owed += toCents(s.amount);
    }
    for (const st of args.settlements) {
        if (st.deletedAt) continue;
        ensure(st.fromUserId, st.currency).sp += toCents(st.amount);
        ensure(st.toUserId, st.currency).sr += toCents(st.amount);
    }
    return acc;
}

function rowToNet(row: LedgerTotals): number {
    return fromCents(row.paid - row.owed + row.sp - row.sr);
}

function isZeroRow(row: LedgerTotals): boolean {
    return row.paid === 0 && row.owed === 0 && row.sp === 0 && row.sr === 0;
}

function netsForUsers(
    acc: LedgerAcc,
    userIds: Iterable<string>,
    sort: boolean,
): NetByUserCurrency[] {
    const currencies = new Set<string>();
    for (const per of acc.values()) {
        for (const c of per.keys()) currencies.add(c);
    }

    const out: NetByUserCurrency[] = [];
    for (const uid of userIds) {
        for (const currency of currencies) {
            const row = acc.get(uid)?.get(currency);
            if (!row || isZeroRow(row)) continue;
            out.push({ userId: uid, currency, net: rowToNet(row) });
        }
    }
    if (sort) {
        out.sort((a, b) =>
            a.userId === b.userId
                ? a.currency.localeCompare(b.currency)
                : a.userId.localeCompare(b.userId),
        );
    }
    return out;
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
    const acc = accumulateLedger(args);
    const active = args.members.filter(m => m.isActive).map(m => m.userId);
    return netsForUsers(acc, active, true);
}

/**
 * Nets aligned with get_user_simplified_inputs: every active member per currency
 * with ledger activity, drop whole currency when max |net| < 0.01.
 */
export function referenceSimplifiedInputNets(args: {
    members: SimMember[];
    expenses: SimExpense[];
    splits: SimSplit[];
    settlements: SimSettlement[];
}): NetByUserCurrency[] {
    const acc = accumulateLedger(args);
    const active = args.members.filter(m => m.isActive).map(m => m.userId);
    const currencies = new Set<string>();
    for (const per of acc.values()) {
        for (const c of per.keys()) currencies.add(c);
    }

    const out: NetByUserCurrency[] = [];
    for (const currency of [...currencies].sort((a, b) => a.localeCompare(b))) {
        const rows: NetByUserCurrency[] = [];
        for (const uid of active) {
            const row = acc.get(uid)?.get(currency);
            rows.push({ userId: uid, currency, net: row ? rowToNet(row) : 0 });
        }
        const maxAbs = Math.max(...rows.map(r => Math.abs(r.net)), 0);
        if (maxAbs < 0.01) continue;
        out.push(...rows);
    }
    return out;
}

/** Nets for every user with ledger activity (incl. inactive members). */
export function referenceAllUserNets(args: {
    members: SimMember[];
    expenses: SimExpense[];
    splits: SimSplit[];
    settlements: SimSettlement[];
}): NetByUserCurrency[] {
    const acc = accumulateLedger(args);
    return netsForUsers(
        acc,
        args.members.map(m => m.userId),
        false,
    );
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

function parseDirectedKey(key: string): [string, string, string] {
    const parts = key.split('|');
    return [parts[0] ?? '', parts[1] ?? '', parts[2] ?? ''];
}

function addComboKeys(combos: Set<string>, key: string): void {
    const [d, c, cur] = parseDirectedKey(key);
    if (!d || !c || !cur) return;
    combos.add(directedKey(d, c, cur));
    combos.add(directedKey(c, d, cur));
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
    const expenseById = liveExpenseMap(args.expenses);

    const expenseDebts = new Map<string, number>();
    for (const s of args.splits) {
        const exp = expenseById.get(s.expenseId);
        if (!exp || s.userId === exp.paidBy) continue;
        const key = directedKey(s.userId, exp.paidBy, exp.currency);
        expenseDebts.set(key, (expenseDebts.get(key) ?? 0) + toCents(s.amount));
    }

    const settlementDebts = new Map<string, number>();
    for (const st of args.settlements) {
        if (st.deletedAt) continue;
        const key = directedKey(st.fromUserId, st.toUserId, st.currency);
        settlementDebts.set(key, (settlementDebts.get(key) ?? 0) + toCents(st.amount));
    }

    const combos = new Set<string>();
    for (const key of expenseDebts.keys()) addComboKeys(combos, key);
    for (const key of settlementDebts.keys()) addComboKeys(combos, key);

    const loHiNet = new Map<string, number>();
    for (const key of combos) {
        const [debtor, creditor, currency] = parseDirectedKey(key);
        if (!debtor || !creditor || !currency) continue;
        const grossCents =
            (expenseDebts.get(key) ?? 0) - (settlementDebts.get(key) ?? 0);
        const lo = debtor < creditor ? debtor : creditor;
        const hi = debtor < creditor ? creditor : debtor;
        const bucket = `${lo}|${hi}|${currency}`;
        const signed = debtor < creditor ? grossCents : -grossCents;
        loHiNet.set(bucket, (loHiNet.get(bucket) ?? 0) + signed);
    }

    const debts: PairwiseDebt[] = [];
    for (const [bucket, loToHiCents] of loHiNet) {
        if (Math.abs(loToHiCents) < 1) continue;
        const [lo, hi, currency] = parseDirectedKey(bucket);
        if (!lo || !hi || !currency) continue;
        const amount = fromCents(Math.abs(loToHiCents));
        if (amount < 0.01) continue;
        if (loToHiCents > 0) {
            debts.push({ fromUserId: lo, toUserId: hi, currency, amount });
        } else {
            debts.push({ fromUserId: hi, toUserId: lo, currency, amount });
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
