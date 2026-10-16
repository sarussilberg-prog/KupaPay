import { supabase } from '../lib/supabase';

export type CategorySpendRow = { category: string; total: number };
export type MemberSpendRow = { memberUserId: string; total: number };
export type WeekSpendRow = { weekStart: string; total: number };

export async function fetchGroupSpendingByCategory(
    groupId: string,
    currency: string,
): Promise<CategorySpendRow[]> {
    const { data, error } = await supabase.rpc('get_group_spending_by_category', {
        p_group_id: groupId,
        p_currency: currency,
    });
    if (error || !data) return [];
    return (data as { category: string; total: number | string }[]).map(row => ({
        category: row.category,
        total: Number.parseFloat(String(row.total)),
    }));
}

export async function fetchGroupSpendingByMember(
    groupId: string,
    currency: string,
): Promise<MemberSpendRow[]> {
    const { data, error } = await supabase.rpc('get_group_spending_by_member', {
        p_group_id: groupId,
        p_currency: currency,
    });
    if (error || !data) return [];
    return (data as { member_user_id: string; total: number | string }[]).map(row => ({
        memberUserId: row.member_user_id,
        total: Number.parseFloat(String(row.total)),
    }));
}

export async function fetchGroupSpendingByWeek(
    groupId: string,
    currency: string,
): Promise<WeekSpendRow[]> {
    const { data, error } = await supabase.rpc('get_group_spending_by_week', {
        p_group_id: groupId,
        p_currency: currency,
    });
    if (error || !data) return [];
    return (data as { week_start: string; total: number | string }[]).map(row => ({
        weekStart: row.week_start,
        total: Number.parseFloat(String(row.total)),
    }));
}
