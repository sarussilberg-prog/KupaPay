import {
    calculateEqualSplit,
    validateExpenseSplits,
    type CreateExpenseDto,
    type ExpenseSplitInput,
} from '@cost-share/shared';
import {
    computeSplitCalculatorTransfers,
    type SplitCalculatorExpense,
    type SplitCalculatorParticipant,
} from './splitCalculatorLogic';
import type { SplitCalculatorImportDraft } from './splitCalculatorImportDraft';

export type SplitCalculatorImportValidationError =
    | 'no_participants'
    | 'no_expenses'
    | 'invalid_amount'
    | 'unbalanced'
    | 'empty_group_name'
    | 'self_not_in_participants';

export type SplitCalculatorImportExpenseDraft = Omit<CreateExpenseDto, 'groupId'>;

export type SplitCalculatorImportPlan = {
    groupName: string;
    defaultCurrency: string;
    /** Calculator participant id → KupaPay profile id (guest or signed-in user). */
    participantUserIds: Map<string, string>;
    /** Guest display names keyed by calculator participant id (excluding self). */
    guestParticipantIds: string[];
    expenses: SplitCalculatorImportExpenseDraft[];
};

export function validateSplitCalculatorImportDraft(
    draft: SplitCalculatorImportDraft,
): SplitCalculatorImportValidationError | null {
    if (!draft.groupName.trim()) {
        return 'empty_group_name';
    }
    if (!draft.participants.some((p) => p.id === draft.selfParticipantId)) {
        return 'self_not_in_participants';
    }
    const calc = computeSplitCalculatorTransfers(
        draft.participants,
        draft.expenses,
        draft.currency,
    );
    if (!calc.ok) {
        return calc.error;
    }
    return null;
}

export function buildSplitCalculatorImportPlan(
    draft: SplitCalculatorImportDraft,
    currentUserId: string,
    guestUserIdsByParticipantId: Map<string, string>,
    formatExpenseDescription: (expenseNumber: number) => string,
): SplitCalculatorImportPlan {
    const participantUserIds = new Map<string, string>();
    const guestParticipantIds: string[] = [];

    for (const participant of draft.participants) {
        if (participant.id === draft.selfParticipantId) {
            participantUserIds.set(participant.id, currentUserId);
            continue;
        }
        const guestId = guestUserIdsByParticipantId.get(participant.id);
        if (!guestId) {
            throw new Error(`Missing guest user id for participant ${participant.id}`);
        }
        participantUserIds.set(participant.id, guestId);
        guestParticipantIds.push(participant.id);
    }

    const expenses = draft.expenses.map((expense, index) =>
        mapCalculatorExpenseToCreateDto(
            expense,
            draft.participants,
            draft.currency,
            participantUserIds,
            formatExpenseDescription(index + 1),
        ),
    );

    return {
        groupName: draft.groupName.trim(),
        defaultCurrency: draft.currency.trim().toUpperCase() || 'USD',
        participantUserIds,
        guestParticipantIds,
        expenses,
    };
}

function activeSplitParticipantIds(
    expense: SplitCalculatorExpense,
    participants: SplitCalculatorParticipant[],
): string[] {
    if (expense.participantIds.length === 0) {
        return participants.map((p) => p.id);
    }
    return expense.participantIds;
}

function mapCalculatorExpenseToCreateDto(
    expense: SplitCalculatorExpense,
    participants: SplitCalculatorParticipant[],
    currency: string,
    participantUserIds: Map<string, string>,
    description: string,
): SplitCalculatorImportExpenseDraft {
    const splitParticipantIds = activeSplitParticipantIds(expense, participants);
    const splits: ExpenseSplitInput[] = splitParticipantIds.map((participantId) => {
        const userId = participantUserIds.get(participantId);
        if (!userId) {
            throw new Error(`Missing user mapping for participant ${participantId}`);
        }
        return { userId };
    });

    const resolved = resolveEqualSplitAmounts(expense.amount, splits);
    const validation = validateExpenseSplits(expense.amount, resolved);
    if (!validation.valid) {
        throw new Error('split_validation_failed');
    }

    const payerUserId = participantUserIds.get(expense.payerId);
    if (!payerUserId) {
        throw new Error(`Missing payer mapping for ${expense.payerId}`);
    }

    return {
        description,
        amount: expense.amount,
        currency: currency.trim().toUpperCase() || 'USD',
        paidBy: payerUserId,
        splitMode: 'equal',
        splits,
    };
}

function resolveEqualSplitAmounts(
    totalAmount: number,
    inputs: ExpenseSplitInput[],
): { userId: string; amount: number }[] {
    const equal = calculateEqualSplit(totalAmount, inputs.length);
    return inputs.map((s, i) => ({ userId: s.userId, amount: equal[i] }));
}
