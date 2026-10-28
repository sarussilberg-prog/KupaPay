import {
    calculateEqualSplit,
    calculateUserBalancesFromData,
    simplifyDebts,
    UnbalancedLedgerError,
    type BalanceExpenseRow,
    type BalanceSplitRow,
} from '@cost-share/shared';

export type SplitCalculatorParticipant = {
    id: string;
    name: string;
};

export type SplitCalculatorExpense = {
    id: string;
    payerId: string;
    amount: number;
    /** Equal split among these participant ids (defaults to all). */
    participantIds: string[];
};

export type SplitCalculatorTransfer = {
    fromUserId: string;
    fromUserName: string;
    toUserId: string;
    toUserName: string;
    amount: number;
    currency: string;
};

export type SplitCalculatorResult =
    | { ok: true; transfers: SplitCalculatorTransfer[]; algorithm: 'exact' | 'greedy' }
    | { ok: false; error: 'no_participants' | 'no_expenses' | 'invalid_amount' | 'unbalanced' };

const CALC_GROUP_ID = 'web-calculator';

export function computeSplitCalculatorTransfers(
    participants: SplitCalculatorParticipant[],
    expenses: SplitCalculatorExpense[],
    currency: string,
): SplitCalculatorResult {
    if (participants.length === 0) {
        return { ok: false, error: 'no_participants' };
    }
    if (expenses.length === 0) {
        return { ok: false, error: 'no_expenses' };
    }

    const nameById = new Map(participants.map((p) => [p.id, p.name.trim() || p.id]));
    const participantIds = participants.map((p) => p.id);
    const participantSet = new Set(participantIds);

    const expenseRows: BalanceExpenseRow[] = [];
    const splitRows: BalanceSplitRow[] = [];

    for (const expense of expenses) {
        if (!Number.isFinite(expense.amount) || expense.amount <= 0) {
            return { ok: false, error: 'invalid_amount' };
        }
        if (!participantSet.has(expense.payerId)) {
            return { ok: false, error: 'invalid_amount' };
        }

        const splitAmong =
            expense.participantIds.length > 0
                ? expense.participantIds.filter((id) => participantSet.has(id))
                : participantIds;

        if (splitAmong.length === 0) {
            return { ok: false, error: 'invalid_amount' };
        }

        expenseRows.push({
            id: expense.id,
            paidBy: expense.payerId,
            amount: Number(expense.amount.toFixed(2)),
        });

        const shares = calculateEqualSplit(expense.amount, splitAmong.length);
        splitAmong.forEach((userId, index) => {
            splitRows.push({
                expenseId: expense.id,
                userId,
                amount: shares[index] ?? 0,
            });
        });
    }

    const balances = calculateUserBalancesFromData(
        CALC_GROUP_ID,
        currency,
        participantIds,
        expenseRows,
        splitRows,
        [],
    );

    try {
        const simplified = simplifyDebts(balances, nameById);
        const transfers: SplitCalculatorTransfer[] = simplified.debts.map((d) => ({
            fromUserId: d.fromUserId,
            fromUserName: d.fromUserName,
            toUserId: d.toUserId,
            toUserName: d.toUserName,
            amount: d.amount,
            currency: d.currency,
        }));
        return {
            ok: true,
            transfers,
            algorithm: simplified.algorithm,
        };
    } catch (err) {
        if (err instanceof UnbalancedLedgerError) {
            return { ok: false, error: 'unbalanced' };
        }
        throw err;
    }
}
