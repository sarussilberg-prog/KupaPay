import { supabase } from '../lib/supabase';
import { showErrorToast, showSuccessMessage } from '../lib/appToast';

export interface GroupTripBudget {
    amount: number | null;
    currency: string | null;
}

export async function fetchGroupTripBudget(groupId: string): Promise<GroupTripBudget> {
    const { data, error } = await supabase
        .from('groups')
        .select('trip_budget_amount, trip_budget_currency')
        .eq('id', groupId)
        .maybeSingle();
    if (error || !data?.trip_budget_amount) {
        return { amount: null, currency: null };
    }
    return {
        amount: Number(data.trip_budget_amount),
        currency: data.trip_budget_currency ?? null,
    };
}

export async function setGroupTripBudget(
    groupId: string,
    amount: number | null,
    currency: string | null,
): Promise<boolean> {
    const { error } = await supabase.rpc('set_group_trip_budget', {
        p_group_id: groupId,
        p_amount: amount,
        p_currency: currency,
    });
    if (error) {
        if (error.message.includes('pro_required')) {
            showErrorToast('pro.tripBudget.proRequired');
        } else {
            showErrorToast('common.errorGeneric');
        }
        return false;
    }
    showSuccessMessage('pro.tripBudget.saved');
    return true;
}
