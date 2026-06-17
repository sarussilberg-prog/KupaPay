/**
 * Simplified-debts service — fetches the canonical RPC payload that every
 * balance UI derives from.
 */

import { SimplifiedInputsPayload } from '@cost-share/shared';
import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../lib/auth';

const EMPTY: SimplifiedInputsPayload = { groups: [] };

export async function fetchSimplifiedInputs(): Promise<SimplifiedInputsPayload> {
    const userId = await getCurrentUserId();
    if (!userId) return EMPTY;
    const { data, error } = await supabase.rpc('get_user_simplified_inputs', {
        p_user_id: userId,
    });
    if (error) {
        console.error('fetchSimplifiedInputs failed:', error);
        return EMPTY;
    }
    return (data as SimplifiedInputsPayload | null) ?? EMPTY;
}
