import { validateExpenseSplits } from '../calculations';
import type {
    SplitwiseImportExpenseDraft,
    SplitwiseMemberMapping,
    SplitwiseParsedExpense,
} from './splitwiseCsvTypes';

export type SplitwiseImportPlan = {
    groupName: string;
    defaultCurrency: string;
    expenses: SplitwiseImportExpenseDraft[];
};

export function buildSplitwiseImportPlan(
    groupName: string,
    defaultCurrency: string,
    parsedExpenses: SplitwiseParsedExpense[],
    mapping: SplitwiseMemberMapping,
    memberNameToUserId: Map<string, string>,
): { ok: true; plan: SplitwiseImportPlan } | { ok: false; error: 'missing_self_mapping' | 'missing_member_mapping' | 'invalid_splits' } {
    if (!memberNameToUserId.has(mapping.selfMemberName)) {
        return { ok: false, error: 'missing_self_mapping' };
    }

    const expenses: SplitwiseImportExpenseDraft[] = [];

    for (const row of parsedExpenses) {
        const payerUserId = memberNameToUserId.get(row.payerMemberName);
        if (!payerUserId) {
            return { ok: false, error: 'missing_member_mapping' };
        }

        const splits = row.splits.map((s) => {
            const userId = memberNameToUserId.get(s.memberName);
            if (!userId) {
                throw new Error('missing_member_mapping');
            }
            return { userId, amount: s.amount };
        });

        const validation = validateExpenseSplits(row.amount, splits);
        if (!validation.valid) {
            return { ok: false, error: 'invalid_splits' };
        }

        expenses.push({
            description: row.description,
            amount: row.amount,
            currency: row.currency,
            category: row.category,
            expenseDate: row.expenseDate,
            paidBy: payerUserId,
            splitMode: 'amount',
            splits,
        });
    }

    return {
        ok: true,
        plan: {
            groupName: groupName.trim(),
            defaultCurrency: defaultCurrency.trim().toUpperCase() || 'USD',
            expenses,
        },
    };
}

export function defaultGuestDisplayNames(
    members: string[],
    selfMemberName: string,
): Record<string, string> {
    const out: Record<string, string> = {};
    for (const name of members) {
        if (name !== selfMemberName) {
            out[name] = name;
        }
    }
    return out;
}
