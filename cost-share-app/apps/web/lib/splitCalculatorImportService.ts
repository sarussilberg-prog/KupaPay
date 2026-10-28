import {
    calculateEqualSplit,
    validateExpenseSplits,
    type CreateExpenseDto,
    type ExpenseSplitInput,
} from '@cost-share/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
    buildSplitCalculatorImportPlan,
    validateSplitCalculatorImportDraft,
    type SplitCalculatorImportValidationError,
} from './splitCalculatorImport';
import type { SplitCalculatorImportDraft } from './splitCalculatorImportDraft';

type SplitCalculatorImportOutcome =
    | { ok: true; groupId: string }
    | { ok: false; error: SplitCalculatorImportValidationError | 'not_authenticated' | 'import_failed' };

function parseRpcFailure(data: unknown): string | null {
    if (!data || typeof data !== 'object') return null;
    const row = data as Record<string, unknown>;
    if (row.ok === false && typeof row.error_code === 'string') {
        return row.error_code;
    }
    return null;
}

function resolveSplitAmounts(
    totalAmount: number,
    inputs: ExpenseSplitInput[],
): { userId: string; amount: number }[] {
    const equal = calculateEqualSplit(totalAmount, inputs.length);
    return inputs.map((s, i) => ({ userId: s.userId, amount: equal[i] }));
}

async function createExpenseWithSplits(
    supabase: SupabaseClient,
    dto: CreateExpenseDto,
): Promise<void> {
    const splits = resolveSplitAmounts(dto.amount, dto.splits);
    const validation = validateExpenseSplits(dto.amount, splits);
    if (!validation.valid) {
        throw new Error('split_validation_failed');
    }

    const expenseDate = (dto.expenseDate ?? new Date()).toISOString().slice(0, 10);
    const { data, error } = await supabase.rpc('create_expense_with_splits', {
        p_group_id: dto.groupId,
        p_description: dto.description,
        p_amount: dto.amount,
        p_currency: dto.currency,
        p_category: dto.category ?? null,
        p_expense_date: expenseDate,
        p_receipt_url: dto.receiptUrl ?? null,
        p_paid_by: dto.paidBy,
        p_split_mode: dto.splitMode ?? 'equal',
        p_splits: splits.map((s) => ({ user_id: s.userId, amount: s.amount })),
    });
    if (error) throw error;
    const failure = parseRpcFailure(data);
    if (failure) throw new Error(failure);
}

export async function runSplitCalculatorImport(
    supabase: SupabaseClient,
    draft: SplitCalculatorImportDraft,
    formatExpenseDescription: (expenseNumber: number) => string,
): Promise<SplitCalculatorImportOutcome> {
    const validationError = validateSplitCalculatorImportDraft(draft);
    if (validationError) {
        return { ok: false, error: validationError };
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
        return { ok: false, error: 'not_authenticated' };
    }
    const currentUserId = userData.user.id;

    try {
        const { data: groupRow, error: groupErr } = await supabase
            .from('groups')
            .insert({
                name: draft.groupName.trim(),
                default_currency: draft.currency.trim().toUpperCase() || 'USD',
                created_by: currentUserId,
                group_type: 'general',
            })
            .select('id')
            .single();
        if (groupErr) throw groupErr;

        const groupId = String(groupRow.id);
        const { error: founderErr } = await supabase.from('group_members').insert({
            group_id: groupId,
            user_id: currentUserId,
        });
        if (founderErr) throw founderErr;

        const guestUserIds = new Map<string, string>();
        for (const participant of draft.participants) {
            if (participant.id === draft.selfParticipantId) continue;
            const displayName = participant.name.trim() || participant.id;
            const { data, error } = await supabase.rpc('add_guest_group_member', {
                p_group_id: groupId,
                p_display_name: displayName,
            });
            if (error) throw error;
            const payload = data as {
                ok?: boolean;
                guest_user_id?: string;
            };
            if (!payload.ok || !payload.guest_user_id) {
                throw new Error('guest_add_failed');
            }
            guestUserIds.set(participant.id, payload.guest_user_id);
        }

        const plan = buildSplitCalculatorImportPlan(
            draft,
            currentUserId,
            guestUserIds,
            formatExpenseDescription,
        );

        for (const expense of plan.expenses) {
            await createExpenseWithSplits(supabase, { ...expense, groupId });
        }

        return { ok: true, groupId };
    } catch {
        return { ok: false, error: 'import_failed' };
    }
}
