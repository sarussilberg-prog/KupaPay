import { calculateEqualSplit, validateExpenseSplits } from '../index';
import { createPrng, pickInt, pickOne } from './prng';
import { referenceNets } from './referenceModel';
import type {
    SimExpense,
    SimMember,
    SimOpKind,
    SimSplit,
    SimulationRunOptions,
    SimulationState,
    SplitMode,
} from './types';

const DEFAULT_CURRENCIES = ['USD', 'EUR', 'ILS'] as const;

function round2(n: number): number {
    return Number(n.toFixed(2));
}

function activeMembers(state: SimulationState): SimMember[] {
    return state.members.filter(m => m.isActive);
}

function activeUserIds(state: SimulationState): string[] {
    return activeMembers(state).map(m => m.userId);
}

function liveExpenses(state: SimulationState): SimExpense[] {
    return state.expenses.filter(e => !e.isDeleted);
}

function toCents(n: number): number {
    return Math.round(n * 100);
}

function fromCents(cents: number): number {
    return Number((cents / 100).toFixed(2));
}

/** Build splits that sum to exactly toCents(amount) — no cross-expense drift. */
function buildSplitsForExpense(
    expense: SimExpense,
    participantIds: string[],
    rng: () => number,
): { userId: string; amount: number }[] {
    const totalCents = toCents(expense.amount);
    const mode = expense.splitMode;

    if (mode === 'equal') {
        const parts = calculateEqualSplit(expense.amount, participantIds.length);
        return participantIds.map((userId, i) => ({
            userId,
            amount: parts[i] ?? 0,
        }));
    }

    let shareCents: number[] = [];

    if (mode === 'percent') {
        let remaining = 100;
        const percents: number[] = [];
        for (let i = 0; i < participantIds.length; i++) {
            if (i === participantIds.length - 1) {
                percents.push(remaining);
            } else {
                const p = pickInt(rng, 0, remaining);
                percents.push(p);
                remaining -= p;
            }
        }
        let allocated = 0;
        for (let i = 0; i < participantIds.length - 1; i++) {
            const c = Math.floor((totalCents * percents[i]!) / 100);
            shareCents.push(c);
            allocated += c;
        }
        shareCents.push(totalCents - allocated);
    } else {
        const weights: number[] = [];
        let sumW = 0;
        for (let i = 0; i < participantIds.length; i++) {
            const w = i === participantIds.length - 1 ? 0 : pickInt(rng, 1, 50);
            weights.push(w);
            sumW += w;
        }
        if (sumW === 0) sumW = participantIds.length;
        let allocated = 0;
        for (let i = 0; i < participantIds.length - 1; i++) {
            const c = Math.floor((totalCents * (weights[i] || 1)) / sumW);
            shareCents.push(c);
            allocated += c;
        }
        shareCents.push(totalCents - allocated);
    }

    return participantIds.map((userId, i) => ({
        userId,
        amount: fromCents(shareCents[i] ?? 0),
    }));
}

function replaceSplitsForExpense(state: SimulationState, expenseId: string, rows: SimSplit[]) {
    state.splits = state.splits.filter(s => s.expenseId !== expenseId);
    state.splits.push(...rows);
}

function memberNetZero(state: SimulationState, userId: string): boolean {
    const nets = referenceNets(state);
    return nets.every(n => n.userId !== userId || Math.abs(n.net) < 0.01);
}

function addExpense(state: SimulationState, rng: () => number): boolean {
    const users = activeUserIds(state);
    if (users.length < 2) return false;

    const payer = pickOne(rng, users);
    const count = pickInt(rng, 2, Math.min(users.length, 4));
    const shuffled = [...users].sort(() => rng() - 0.5);
    const participants = shuffled.slice(0, count);
    if (!participants.includes(payer)) participants[0] = payer;

    const currency =
        rng() < 0.35
            ? pickOne(rng, DEFAULT_CURRENCIES)
            : state.defaultCurrency;
    const amount = round2(pickInt(rng, 1, 5000) / 100);
    const splitMode = pickOne(rng, ['equal', 'percent', 'amount'] as SplitMode[]);

    const id = `e_${state.nextExpenseSeq++}`;
    const expense: SimExpense = {
        id,
        paidBy: payer,
        amount,
        currency,
        splitMode,
        isDeleted: false,
    };

    const splitRows = buildSplitsForExpense(expense, participants, rng);
    const validation = validateExpenseSplits(amount, splitRows);
    if (!validation.valid) return false;

    state.expenses.push(expense);
    replaceSplitsForExpense(
        state,
        id,
        splitRows.map(r => ({ expenseId: id, userId: r.userId, amount: r.amount })),
    );
    return true;
}

function editExpense(state: SimulationState, rng: () => number): boolean {
    const live = liveExpenses(state);
    if (live.length === 0) return false;
    const expense = pickOne(rng, live);
    const users = activeUserIds(state);
    if (users.length < 2) return false;

    if (rng() < 0.5) {
        expense.amount = round2(pickInt(rng, 1, 8000) / 100);
    }
    if (rng() < 0.4) {
        expense.paidBy = pickOne(rng, users);
    }
    if (rng() < 0.35) {
        expense.currency = pickOne(rng, DEFAULT_CURRENCIES);
    }
    if (rng() < 0.3) {
        expense.splitMode = pickOne(rng, ['equal', 'percent', 'amount'] as SplitMode[]);
    }

    const count = pickInt(rng, 2, Math.min(users.length, 4));
    const participants = [...users].sort(() => rng() - 0.5).slice(0, count);
    if (!participants.includes(expense.paidBy)) participants[0] = expense.paidBy;

    const splitRows = buildSplitsForExpense(expense, participants, rng);
    const validation = validateExpenseSplits(expense.amount, splitRows);
    if (!validation.valid) return false;

    replaceSplitsForExpense(
        state,
        expense.id,
        splitRows.map(r => ({ expenseId: expense.id, userId: r.userId, amount: r.amount })),
    );
    return true;
}

function deleteExpense(state: SimulationState, rng: () => number): boolean {
    const live = liveExpenses(state);
    if (live.length === 0) return false;
    pickOne(rng, live).isDeleted = true;
    return true;
}

function addSettlement(state: SimulationState, rng: () => number): boolean {
    const nets = referenceNets(state);
    const debtors = nets.filter(n => n.net < -0.009);
    const creditors = nets.filter(n => n.net > 0.009);
    if (debtors.length === 0 || creditors.length === 0) return false;

    const debtor = pickOne(rng, debtors);
    const matchingCreditors = creditors.filter(c => c.currency === debtor.currency);
    if (matchingCreditors.length === 0) return false;
    const creditor = pickOne(rng, matchingCreditors);

    const max = round2(Math.min(Math.abs(debtor.net), creditor.net));
    if (max < 0.01) return false;
    const amount =
        rng() < 0.25 ? max : round2(pickInt(rng, 1, Math.max(1, Math.round(max * 100))) / 100);
    if (amount < 0.01 || amount > max + 0.01) return false;

    state.settlements.push({
        id: `s_${state.nextSettlementSeq++}`,
        fromUserId: debtor.userId,
        toUserId: creditor.userId,
        amount,
        currency: debtor.currency,
        deletedAt: null,
    });
    return true;
}

function settleAll(state: SimulationState): boolean {
    const nets = referenceNets(state);
    const byCurrency = new Map<string, { debtors: typeof nets; creditors: typeof nets }>();
    for (const n of nets) {
        let bucket = byCurrency.get(n.currency);
        if (!bucket) {
            bucket = { debtors: [], creditors: [] };
            byCurrency.set(n.currency, bucket);
        }
        if (n.net < -0.009) bucket.debtors.push(n);
        if (n.net > 0.009) bucket.creditors.push(n);
    }

    let added = false;
    for (const [currency, bucket] of byCurrency) {
        const debtors = [...bucket.debtors].sort((a, b) => a.net - b.net);
        const creditors = [...bucket.creditors].sort((a, b) => b.net - a.net);
        let di = 0;
        let ci = 0;
        while (di < debtors.length && ci < creditors.length) {
            const d = debtors[di]!;
            const c = creditors[ci]!;
            const pay = round2(Math.min(Math.abs(d.net), c.net));
            if (pay < 0.01) {
                if (Math.abs(d.net) < 0.01) di++;
                if (Math.abs(c.net) < 0.01) ci++;
                continue;
            }
            state.settlements.push({
                id: `s_${state.nextSettlementSeq++}`,
                fromUserId: d.userId,
                toUserId: c.userId,
                amount: pay,
                currency,
                deletedAt: null,
            });
            d.net = round2(d.net + pay);
            c.net = round2(c.net - pay);
            added = true;
            if (Math.abs(d.net) < 0.01) di++;
            if (Math.abs(c.net) < 0.01) ci++;
        }
    }
    return added;
}

function memberJoin(state: SimulationState): boolean {
    if (state.members.filter(m => m.isActive).length >= 8) return false;
    const id = `u_${state.nextMemberSeq++}`;
    state.members.push({ userId: id, isActive: true });
    return true;
}

function hasLiveSplitParticipation(state: SimulationState, userId: string): boolean {
    const liveIds = new Set(liveExpenses(state).map(e => e.id));
    return state.splits.some(s => s.userId === userId && liveIds.has(s.expenseId));
}

function memberLeave(state: SimulationState, rng: () => number): boolean {
    const actives = activeMembers(state);
    if (actives.length <= 2) return false;
    const candidate = pickOne(rng, actives);
    if (!memberNetZero(state, candidate.userId)) return false;
    if (hasLiveSplitParticipation(state, candidate.userId)) return false;
    const paidLive = liveExpenses(state).some(e => e.paidBy === candidate.userId);
    if (paidLive) return false;
    candidate.isActive = false;
    return true;
}

function tryOp(state: SimulationState, kind: SimOpKind, rng: () => number): boolean {
    switch (kind) {
        case 'add_expense':
            return addExpense(state, rng);
        case 'edit_expense':
            return editExpense(state, rng);
        case 'delete_expense':
            return deleteExpense(state, rng);
        case 'settlement':
            return addSettlement(state, rng);
        case 'settle_all':
            return settleAll(state);
        case 'member_join':
            return memberJoin(state);
        case 'member_leave':
            return memberLeave(state, rng);
        default:
            return false;
    }
}

const OP_WEIGHTS: { kind: SimOpKind; weight: number }[] = [
    { kind: 'add_expense', weight: 40 },
    { kind: 'edit_expense', weight: 12 },
    { kind: 'delete_expense', weight: 8 },
    { kind: 'settlement', weight: 18 },
    { kind: 'settle_all', weight: 6 },
    { kind: 'member_join', weight: 8 },
    { kind: 'member_leave', weight: 8 },
];

function pickOpKind(rng: () => number): SimOpKind {
    const total = OP_WEIGHTS.reduce((s, w) => s + w.weight, 0);
    let roll = rng() * total;
    for (const w of OP_WEIGHTS) {
        roll -= w.weight;
        if (roll <= 0) return w.kind;
    }
    return 'add_expense';
}

export function createInitialState(options: SimulationRunOptions): SimulationState {
    const memberCount = options.initialMemberCount ?? 4;
    const members: SimMember[] = Array.from({ length: memberCount }, (_, i) => ({
        userId: `u_${i}`,
        isActive: true,
    }));
    return {
        groupId: options.groupId ?? 'g_sim',
        defaultCurrency: 'USD',
        members,
        expenses: [],
        splits: [],
        settlements: [],
        nextExpenseSeq: 0,
        nextSettlementSeq: 0,
        nextMemberSeq: memberCount,
    };
}

function seedInitialExpenses(state: SimulationState, rng: () => number): void {
    for (let i = 0; i < 5; i++) {
        if (!addExpense(state, rng)) i--;
    }
}

export function replayGroupLedgerOps(
    state: SimulationState,
    seed: number,
    opCount: number,
    afterOp?: (ctx: { opIndex: number; opKind: SimOpKind | 'seed' }) => void,
): void {
    const rng = createPrng(seed);
    seedInitialExpenses(state, rng);
    afterOp?.({ opIndex: -1, opKind: 'seed' });

    for (let op = 0; op < opCount; op++) {
        const kind = pickOpKind(rng);
        let attempts = 0;
        while (!tryOp(state, kind, rng) && attempts < 8) {
            attempts++;
        }
        afterOp?.({ opIndex: op, opKind: kind });
    }
}
