import { Injectable } from '@nestjs/common';
import {
    UserBalance,
    GroupSummary,
    DebtSummary,
} from '@cost-share/shared';
import { SupabaseService } from '../database/supabase.service';

@Injectable()
export class CalculationsService {
    constructor(private readonly supabase: SupabaseService) {}

    /**
     * Net balance per user in a group:
     *   netBalance = totalPaid - totalOwed + totalSettledReceived - totalSettledPaid
     * Positive = user is owed money; negative = user owes money.
     */
    async calculateUserBalances(groupId: string, userId?: string): Promise<UserBalance[]> {
        const sb = this.supabase.client;

        const [groupRes, membersRes, expensesRes, settlementsRes] = await Promise.all([
            sb.from('groups').select('default_currency').eq('id', groupId).maybeSingle(),
            sb.from('group_members').select('user_id').eq('group_id', groupId).eq('is_active', true),
            sb.from('expenses').select('id, paid_by, amount').eq('group_id', groupId).eq('is_deleted', false),
            sb.from('settlements').select('from_user_id, to_user_id, amount').eq('group_id', groupId),
        ]);

        if (groupRes.error) throw groupRes.error;
        if (membersRes.error) throw membersRes.error;
        if (expensesRes.error) throw expensesRes.error;
        if (settlementsRes.error) throw settlementsRes.error;

        const defaultCurrency = groupRes.data?.default_currency ?? 'USD';
        const expenses = (expensesRes.data ?? []).map(e => ({
            id: e.id as string,
            paidBy: e.paid_by as string,
            amount: Number(e.amount),
        }));
        const settlements = (settlementsRes.data ?? []).map(s => ({
            fromUserId: s.from_user_id as string,
            toUserId: s.to_user_id as string,
            amount: Number(s.amount),
        }));

        const expenseIds = expenses.map(e => e.id);
        let splits: { expenseId: string; userId: string; amount: number }[] = [];
        if (expenseIds.length > 0) {
            const { data: splitsData, error: splitsErr } = await sb
                .from('expense_splits')
                .select('expense_id, user_id, amount')
                .in('expense_id', expenseIds);
            if (splitsErr) throw splitsErr;
            splits = (splitsData ?? []).map(s => ({
                expenseId: s.expense_id as string,
                userId: s.user_id as string,
                amount: Number(s.amount),
            }));
        }

        const userIds = userId
            ? [userId]
            : Array.from(new Set((membersRes.data ?? []).map(m => m.user_id as string)));

        return userIds.map(uid => {
            const totalPaid = expenses
                .filter(e => e.paidBy === uid)
                .reduce((sum, e) => sum + e.amount, 0);

            const totalOwed = splits
                .filter(s => s.userId === uid)
                .reduce((sum, s) => sum + s.amount, 0);

            const totalSettledPaid = settlements
                .filter(s => s.fromUserId === uid)
                .reduce((sum, s) => sum + s.amount, 0);

            const totalSettledReceived = settlements
                .filter(s => s.toUserId === uid)
                .reduce((sum, s) => sum + s.amount, 0);

            const netBalance = totalPaid - totalOwed + totalSettledReceived - totalSettledPaid;

            return {
                groupId,
                userId: uid,
                currency: defaultCurrency,
                totalPaid: Number(totalPaid.toFixed(2)),
                totalOwed: Number(totalOwed.toFixed(2)),
                totalSettledPaid: Number(totalSettledPaid.toFixed(2)),
                totalSettledReceived: Number(totalSettledReceived.toFixed(2)),
                netBalance: Number(netBalance.toFixed(2)),
            };
        });
    }

    async getWhoOwesWhom(groupId: string): Promise<DebtSummary[]> {
        const balances = await this.calculateUserBalances(groupId);
        const debts: DebtSummary[] = [];

        const creditors = balances.filter(b => b.netBalance > 0.01).map(b => ({ ...b }));
        const debtors = balances.filter(b => b.netBalance < -0.01).map(b => ({ ...b }));

        const userIds = Array.from(new Set([
            ...creditors.map(c => c.userId),
            ...debtors.map(d => d.userId),
        ]));
        const nameById = new Map<string, string>();
        if (userIds.length > 0) {
            const { data, error } = await this.supabase.client
                .from('profiles')
                .select('id, name')
                .in('id', userIds);
            if (error) throw error;
            (data ?? []).forEach((p: any) => nameById.set(p.id, p.name));
        }

        for (const debtor of debtors) {
            let remaining = Math.abs(debtor.netBalance);
            for (const creditor of creditors) {
                if (remaining <= 0.01) break;
                if (creditor.netBalance <= 0.01) continue;

                const amount = Math.min(remaining, creditor.netBalance);
                debts.push({
                    fromUserId: debtor.userId,
                    fromUserName: nameById.get(debtor.userId) ?? 'Unknown',
                    toUserId: creditor.userId,
                    toUserName: nameById.get(creditor.userId) ?? 'Unknown',
                    amount: Number(amount.toFixed(2)),
                    currency: debtor.currency,
                });

                remaining -= amount;
                creditor.netBalance -= amount;
            }
        }

        return debts;
    }

    async calculateGroupSummary(groupId: string): Promise<GroupSummary | null> {
        const sb = this.supabase.client;

        const { data: group, error: groupErr } = await sb
            .from('groups')
            .select('*')
            .eq('id', groupId)
            .eq('is_active', true)
            .maybeSingle();
        if (groupErr) throw groupErr;
        if (!group) return null;

        const [{ count: memberCount, error: mErr }, expensesRes] = await Promise.all([
            sb.from('group_members')
                .select('id', { count: 'exact', head: true })
                .eq('group_id', groupId)
                .eq('is_active', true),
            sb.from('expenses')
                .select('amount, expense_date')
                .eq('group_id', groupId)
                .eq('is_deleted', false),
        ]);
        if (mErr) throw mErr;
        if (expensesRes.error) throw expensesRes.error;

        const expenses = expensesRes.data ?? [];
        const totalSpent = expenses.reduce((sum, e: any) => sum + Number(e.amount), 0);
        const lastExpenseDate = expenses.length > 0
            ? new Date(Math.max(...expenses.map((e: any) => new Date(e.expense_date).getTime())))
            : undefined;

        return {
            groupId: group.id,
            name: group.name,
            groupType: group.group_type,
            defaultCurrency: group.default_currency,
            memberCount: memberCount ?? 0,
            expenseCount: expenses.length,
            totalSpent: Number(totalSpent.toFixed(2)),
            lastExpenseDate,
            createdAt: new Date(group.created_at),
            updatedAt: new Date(group.updated_at),
        };
    }

    async getUserGroupSummaries(userId: string): Promise<GroupSummary[]> {
        const { data, error } = await this.supabase.client
            .from('group_members')
            .select('group_id')
            .eq('user_id', userId)
            .eq('is_active', true);
        if (error) throw error;

        const groupIds = (data ?? []).map((r: any) => r.group_id as string);
        const summaries = await Promise.all(
            groupIds.map(id => this.calculateGroupSummary(id)),
        );
        return summaries.filter((s): s is GroupSummary => s !== null);
    }

    async validateSettlement(
        groupId: string,
        fromUserId: string,
        toUserId: string,
        amount: number,
    ): Promise<{ valid: boolean; message?: string; maxAmount?: number }> {
        const balances = await this.calculateUserBalances(groupId);
        const fromUserBalance = balances.find(b => b.userId === fromUserId);
        const toUserBalance = balances.find(b => b.userId === toUserId);

        if (!fromUserBalance || !toUserBalance) {
            return { valid: false, message: 'User not found in group' };
        }
        if (fromUserBalance.netBalance >= 0) {
            return { valid: false, message: 'User does not owe money in this group' };
        }
        if (toUserBalance.netBalance <= 0) {
            return { valid: false, message: 'Target user is not owed money in this group' };
        }

        const maxAmount = Math.min(
            Math.abs(fromUserBalance.netBalance),
            toUserBalance.netBalance,
        );

        if (amount > maxAmount + 0.01) {
            return {
                valid: false,
                message: `Settlement amount exceeds maximum of ${maxAmount.toFixed(2)}`,
                maxAmount: Number(maxAmount.toFixed(2)),
            };
        }

        return { valid: true, maxAmount: Number(maxAmount.toFixed(2)) };
    }

    calculateEqualSplit(totalAmount: number, numPeople: number): number[] {
        const baseAmount = Math.floor((totalAmount * 100) / numPeople) / 100;
        const remainder = Number((totalAmount - (baseAmount * numPeople)).toFixed(2));
        const splits = new Array(numPeople).fill(baseAmount);
        if (remainder > 0) {
            splits[splits.length - 1] = Number((splits[splits.length - 1] + remainder).toFixed(2));
        }
        return splits;
    }

    validateExpenseSplits(
        totalAmount: number,
        splits: { userId: string; amount: number }[],
    ): { valid: boolean; message?: string; difference?: number } {
        const splitSum = splits.reduce((sum, s) => sum + s.amount, 0);
        const difference = Number((totalAmount - splitSum).toFixed(2));

        if (Math.abs(difference) > 0.01) {
            return {
                valid: false,
                message: `Splits sum (${splitSum.toFixed(2)}) does not equal total amount (${totalAmount.toFixed(2)})`,
                difference,
            };
        }
        if (splits.some(s => s.amount < 0)) {
            return { valid: false, message: 'Split amounts cannot be negative' };
        }
        return { valid: true };
    }
}
