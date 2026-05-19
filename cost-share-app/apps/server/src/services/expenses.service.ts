import { Injectable } from '@nestjs/common';
import {
    Expense,
    ExpenseSplit,
    CreateExpenseDto,
    UpdateExpenseDto,
} from '@cost-share/shared';
import { SupabaseService } from '../database/supabase.service';
import { expenseFromRow, expenseSplitFromRow } from '../database/mappers';
import { CalculationsService } from './calculations.service';

@Injectable()
export class ExpensesService {
    constructor(
        private readonly supabase: SupabaseService,
        private readonly calculationsService: CalculationsService,
    ) {}

    async findAll(): Promise<Expense[]> {
        const { data, error } = await this.supabase.client
            .from('expenses')
            .select('*')
            .eq('is_deleted', false)
            .order('expense_date', { ascending: false });
        if (error) throw error;
        return (data ?? []).map(expenseFromRow);
    }

    async findById(id: string): Promise<Expense | undefined> {
        const { data, error } = await this.supabase.client
            .from('expenses')
            .select('*')
            .eq('id', id)
            .eq('is_deleted', false)
            .maybeSingle();
        if (error) throw error;
        return data ? expenseFromRow(data) : undefined;
    }

    async findByGroupId(groupId: string): Promise<Expense[]> {
        const { data, error } = await this.supabase.client
            .from('expenses')
            .select('*')
            .eq('group_id', groupId)
            .eq('is_deleted', false)
            .order('expense_date', { ascending: false });
        if (error) throw error;
        return (data ?? []).map(expenseFromRow);
    }

    async create(
        dto: CreateExpenseDto,
        createdBy: string,
    ): Promise<Expense | { error: string }> {
        const splits = dto.splits.map(s => ({ userId: s.userId, amount: s.amount ?? 0 }));

        if (splits.some(s => s.amount === 0)) {
            const equal = this.calculationsService.calculateEqualSplit(dto.amount, splits.length);
            splits.forEach((s, i) => { s.amount = equal[i]; });
        }

        const validation = this.calculationsService.validateExpenseSplits(dto.amount, splits);
        if (!validation.valid) return { error: validation.message || 'Invalid expense splits' };

        const expenseDate = (dto.expenseDate ?? new Date()).toISOString().slice(0, 10);

        const { data: expenseRow, error: expenseErr } = await this.supabase.client
            .from('expenses')
            .insert({
                group_id: dto.groupId,
                description: dto.description,
                amount: dto.amount,
                currency: dto.currency,
                category: dto.category,
                expense_date: expenseDate,
                receipt_url: dto.receiptUrl,
                paid_by: dto.paidBy,
                created_by: createdBy,
            })
            .select()
            .single();
        if (expenseErr) throw expenseErr;

        const splitRows = splits.map(s => ({
            expense_id: expenseRow.id,
            user_id: s.userId,
            amount: s.amount,
        }));
        const { error: splitsErr } = await this.supabase.client
            .from('expense_splits')
            .insert(splitRows);
        if (splitsErr) throw splitsErr;

        return expenseFromRow(expenseRow);
    }

    async update(
        id: string,
        dto: UpdateExpenseDto,
    ): Promise<Expense | { error: string } | undefined> {
        const existing = await this.findById(id);
        if (!existing) return undefined;

        if (dto.splits) {
            const amount = dto.amount ?? existing.amount;
            const splitsWithAmounts = dto.splits.map(s => ({ userId: s.userId, amount: s.amount ?? 0 }));
            const validation = this.calculationsService.validateExpenseSplits(amount, splitsWithAmounts);
            if (!validation.valid) return { error: validation.message || 'Invalid expense splits' };

            const { error: delErr } = await this.supabase.client
                .from('expense_splits')
                .delete()
                .eq('expense_id', id);
            if (delErr) throw delErr;

            const splitRows = dto.splits.map(s => ({
                expense_id: id,
                user_id: s.userId,
                amount: s.amount ?? 0,
            }));
            const { error: insErr } = await this.supabase.client
                .from('expense_splits')
                .insert(splitRows);
            if (insErr) throw insErr;
        }

        const patch: Record<string, any> = {};
        if (dto.description !== undefined) patch.description = dto.description;
        if (dto.amount !== undefined) patch.amount = dto.amount;
        if (dto.currency !== undefined) patch.currency = dto.currency;
        if (dto.category !== undefined) patch.category = dto.category;
        if (dto.expenseDate !== undefined) patch.expense_date = dto.expenseDate.toISOString().slice(0, 10);
        if (dto.receiptUrl !== undefined) patch.receipt_url = dto.receiptUrl;

        if (Object.keys(patch).length === 0) {
            return existing;
        }

        const { data, error } = await this.supabase.client
            .from('expenses')
            .update(patch)
            .eq('id', id)
            .select()
            .maybeSingle();
        if (error) throw error;
        return data ? expenseFromRow(data) : undefined;
    }

    async delete(id: string): Promise<boolean> {
        const { data, error } = await this.supabase.client
            .from('expenses')
            .update({ is_deleted: true })
            .eq('id', id)
            .select('id')
            .maybeSingle();
        if (error) throw error;
        return data !== null;
    }

    async findByUserId(userId: string): Promise<Expense[]> {
        const { data: splitRows, error: splitsErr } = await this.supabase.client
            .from('expense_splits')
            .select('expense_id')
            .eq('user_id', userId);
        if (splitsErr) throw splitsErr;
        const expenseIdsFromSplits = (splitRows ?? []).map((r: any) => r.expense_id);

        const orFilter = expenseIdsFromSplits.length
            ? `paid_by.eq.${userId},id.in.(${expenseIdsFromSplits.join(',')})`
            : `paid_by.eq.${userId}`;

        const { data, error } = await this.supabase.client
            .from('expenses')
            .select('*')
            .eq('is_deleted', false)
            .or(orFilter);
        if (error) throw error;
        return (data ?? []).map(expenseFromRow);
    }

    async getSplits(expenseId: string): Promise<ExpenseSplit[]> {
        const { data, error } = await this.supabase.client
            .from('expense_splits')
            .select('*')
            .eq('expense_id', expenseId);
        if (error) throw error;
        return (data ?? []).map(expenseSplitFromRow);
    }

    async getExpenseWithSplits(
        expenseId: string,
    ): Promise<{ expense: Expense; splits: ExpenseSplit[] } | undefined> {
        const expense = await this.findById(expenseId);
        if (!expense) return undefined;
        const splits = await this.getSplits(expenseId);
        return { expense, splits };
    }
}
