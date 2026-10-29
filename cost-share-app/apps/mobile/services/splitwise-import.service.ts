/**
 * Creates a KupaPay group + expenses from a parsed Splitwise CSV export.
 */

import {
    buildSplitwiseImportPlan,
    type CreateExpenseDto,
    type SplitwiseMemberMapping,
    type SplitwiseParsedExpense,
} from '@cost-share/shared';
import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../lib/auth';
import { createExpense } from './expenses.service';

export type SplitwiseImportOutcome =
    | { ok: true; groupId: string; importedCount: number; skippedCount: number }
    | {
          ok: false;
          error:
              | 'not_authenticated'
              | 'missing_self_mapping'
              | 'missing_member_mapping'
              | 'invalid_splits'
              | 'empty_group_name'
              | 'import_failed';
      };

export async function runSplitwiseImport(params: {
    groupName: string;
    defaultCurrency: string;
    expenses: SplitwiseParsedExpense[];
    mapping: SplitwiseMemberMapping;
    skippedCount: number;
}): Promise<SplitwiseImportOutcome> {
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) {
        return { ok: false, error: 'not_authenticated' };
    }

    const trimmedName = params.groupName.trim();
    if (!trimmedName) {
        return { ok: false, error: 'empty_group_name' };
    }

    try {
        const { data: groupRow, error: groupErr } = await supabase
            .from('groups')
            .insert({
                name: trimmedName,
                default_currency: params.defaultCurrency.trim().toUpperCase() || 'USD',
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

        const memberNameToUserId = new Map<string, string>();
        memberNameToUserId.set(params.mapping.selfMemberName, currentUserId);

        for (const memberName of Object.keys(params.mapping.guestDisplayNames)) {
            const displayName =
                params.mapping.guestDisplayNames[memberName]?.trim() || memberName;
            const { data, error } = await supabase.rpc('add_guest_group_member', {
                p_group_id: groupId,
                p_display_name: displayName,
            });
            if (error) throw error;
            const payload = data as { ok?: boolean; guest_user_id?: string };
            if (!payload.ok || !payload.guest_user_id) {
                throw new Error('guest_add_failed');
            }
            memberNameToUserId.set(memberName, payload.guest_user_id);
        }

        const planResult = buildSplitwiseImportPlan(
            trimmedName,
            params.defaultCurrency,
            params.expenses,
            params.mapping,
            memberNameToUserId,
        );
        if (!planResult.ok) {
            return { ok: false, error: planResult.error };
        }

        for (const expense of planResult.plan.expenses) {
            const dto: CreateExpenseDto = {
                groupId,
                description: expense.description,
                amount: expense.amount,
                currency: expense.currency,
                expenseDate: new Date(`${expense.expenseDate}T12:00:00`),
                paidBy: expense.paidBy,
                splitMode: expense.splitMode,
                splits: expense.splits.map((s) => ({ userId: s.userId, amount: s.amount })),
            };
            await createExpense(dto);
        }

        return {
            ok: true,
            groupId,
            importedCount: planResult.plan.expenses.length,
            skippedCount: params.skippedCount,
        };
    } catch {
        return { ok: false, error: 'import_failed' };
    }
}
