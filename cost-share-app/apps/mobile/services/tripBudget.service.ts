import { supabase } from '../lib/supabase';

export type TripBudgetSettings = {
    amount: number | null;
    currency: string | null;
};

export async function setGroupTripBudget(
    groupId: string,
    amount: number | null,
    currency: string,
): Promise<boolean> {
    const { error } = await supabase.rpc('set_group_trip_budget', {
        p_group_id: groupId,
        p_amount: amount,
        p_currency: currency,
    });
    return !error;
}

export async function fetchGroupTripBudget(groupId: string): Promise<TripBudgetSettings | null> {
    const { data, error } = await supabase
        .from('groups')
        .select('trip_budget_amount, trip_budget_currency')
        .eq('id', groupId)
        .maybeSingle();
    if (error || !data) return null;
    const raw = data.trip_budget_amount;
    const amount =
        raw === null || raw === undefined ? null : Number.parseFloat(String(raw));
    return {
        amount: amount !== null && Number.isFinite(amount) ? amount : null,
        currency: (data.trip_budget_currency as string | null) ?? null,
    };
}
