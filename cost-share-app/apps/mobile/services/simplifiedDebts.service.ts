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
    if (!userId) {
        // Throw rather than return EMPTY for the same reason as the RPC-error
        // branch below: a transiently-missing user (e.g. the session momentarily
        // unreadable) must NOT be cached/persisted as "all settled". Throwing
        // keeps React Query's last-known-good balances and marks the query
        // errored so the UI shows real numbers or a neutral placeholder.
        throw new Error('fetchSimplifiedInputs: no authenticated user');
    }
    const { data, error } = await supabase.rpc('get_user_simplified_inputs', {
        p_user_id: userId,
    });
    if (error) {
        // Throw rather than return EMPTY: a transient RPC failure must NOT be
        // cached/persisted as "all settled". Throwing keeps React Query's last
        // good (persisted) data and marks the query errored, so every balance
        // surface shows the last-known-valid numbers instead of false zeros.
        console.error('fetchSimplifiedInputs failed:', error);
        throw new Error(error.message ?? 'fetchSimplifiedInputs failed');
    }
    return (data as SimplifiedInputsPayload | null) ?? EMPTY;
}
