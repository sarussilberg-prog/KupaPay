/**
 * Pro recurring expense series — Supabase RPCs (#167).
 */

import type { CreateExpenseDto, ExpenseSplitInput, RecurringFrequency } from '@cost-share/shared';
import { expenseFromRow, expenseSplitFromRow, validateExpenseSplits } from '@cost-share/shared';
import type { ExpenseWithSplits } from '@cost-share/shared';
import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../lib/auth';
import { resolveSplitAmounts } from './expenses.service';

export interface RecurringSeriesMeta {
    seriesId: string;
    frequency: RecurringFrequency;
    nextRunDate: string;
    endedAt: string | null;
    scheduledFor: string;
}

export async function createRecurringExpenseSeries(
    dto: CreateExpenseDto,
    frequency: RecurringFrequency,
): Promise<{ expense: ExpenseWithSplits; seriesId: string }> {
    const createdBy = await getCurrentUserId();
    if (!createdBy) throw new Error('createRecurringExpenseSeries: no authenticated user');

    const splits = resolveSplitAmounts(dto.amount, dto.splits);
    const validation = validateExpenseSplits(dto.amount, splits);
    if (!validation.valid) {
        throw new Error('createRecurringExpenseSeries: invalid splits');
    }

    const expenseDate = (dto.expenseDate ?? new Date()).toISOString().slice(0, 10);

    const { data, error } = await supabase.rpc('create_recurring_expense_series', {
        p_group_id: dto.groupId,
        p_description: dto.description,
        p_amount: dto.amount,
        p_currency: dto.currency,
        p_category: dto.category ?? null,
        p_expense_date: expenseDate,
        p_receipt_url: dto.receiptUrl ?? null,
        p_paid_by: dto.paidBy,
        p_split_mode: dto.splitMode ?? 'equal',
        p_splits: splits.map(s => ({ user_id: s.userId, amount: s.amount })),
        p_frequency: frequency,
        p_timezone_hint: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
    });
    if (error) throw error;

    const payload = data as { seriesId: string; expenseId: string };
    const { data: expenseRow, error: fetchErr } = await supabase
        .from('expenses')
        .select('*, expense_splits(*)')
        .eq('id', payload.expenseId)
        .maybeSingle();
    if (fetchErr || !expenseRow) {
        throw fetchErr ?? new Error('createRecurringExpenseSeries: expense missing');
    }

    const expense = expenseFromRow(expenseRow);
    const splitRows = Array.isArray(expenseRow.expense_splits) ? expenseRow.expense_splits : [];
    const expenseSplits = splitRows.map(expenseSplitFromRow);

    return {
        seriesId: payload.seriesId,
        expense: { ...expense, splits: expenseSplits },
    };
}

export async function getRecurringSeriesForExpense(
    expenseId: string,
): Promise<RecurringSeriesMeta | null> {
    const { data, error } = await supabase.rpc('get_recurring_series_for_expense', {
        p_expense_id: expenseId,
    });
    if (error || !data) return null;
    const row = data as Record<string, unknown>;
    if (!row.seriesId) return null;
    return {
        seriesId: String(row.seriesId),
        frequency: row.frequency as RecurringFrequency,
        nextRunDate: String(row.nextRunDate),
        endedAt: row.endedAt ? String(row.endedAt) : null,
        scheduledFor: String(row.scheduledFor),
    };
}

export async function stopRecurringExpenseSeries(seriesId: string): Promise<boolean> {
    const { error } = await supabase.rpc('stop_recurring_expense_series', {
        p_series_id: seriesId,
    });
    return !error;
}

export interface UpdateRecurringSeriesDto {
    description: string;
    amount: number;
    currency: string;
    category: string | null;
    paidBy: string;
    splitMode: string;
    splits: ExpenseSplitInput[];
    frequency?: RecurringFrequency;
}

export async function updateRecurringExpenseSeries(
    seriesId: string,
    dto: UpdateRecurringSeriesDto,
): Promise<boolean> {
    const splits = resolveSplitAmounts(dto.amount, dto.splits);
    const validation = validateExpenseSplits(dto.amount, splits);
    if (!validation.valid) {
        throw new Error('updateRecurringExpenseSeries: invalid splits');
    }

    const { error } = await supabase.rpc('update_recurring_expense_series', {
        p_series_id: seriesId,
        p_description: dto.description,
        p_amount: dto.amount,
        p_currency: dto.currency,
        p_category: dto.category,
        p_paid_by: dto.paidBy,
        p_split_mode: dto.splitMode,
        p_splits: splits.map(s => ({ user_id: s.userId, amount: s.amount })),
        p_frequency: dto.frequency ?? null,
    });
    return !error;
}
