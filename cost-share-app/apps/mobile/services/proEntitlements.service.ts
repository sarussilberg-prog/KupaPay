import { hasProFromTimestamps, type ProStatusTimestamps } from '@cost-share/shared';
import { supabase } from '../lib/supabase';

export interface MyProStatus extends ProStatusTimestamps {
    hasPro: boolean;
    includedTripPassCredits: number;
    unassignedTripPassCount: number;
}

function parseStatusRow(data: Record<string, unknown> | null): MyProStatus {
    const individual = (data?.individualProUntil ?? data?.individual_pro_until) as string | null;
    const groupPass = (data?.groupPassUntil ?? data?.group_pass_until) as string | null;
    const creditsRaw = data?.includedTripPassCredits ?? data?.included_trip_pass_credits;
    const unassignedRaw = data?.unassignedTripPassCount ?? data?.unassigned_trip_pass_count;
    const status: MyProStatus = {
        individualProUntil: individual ?? null,
        groupPassUntil: groupPass ?? null,
        includedTripPassCredits: typeof creditsRaw === 'number' ? creditsRaw : 0,
        unassignedTripPassCount: typeof unassignedRaw === 'number' ? unassignedRaw : 0,
        hasPro: false,
    };
    status.hasPro =
        data?.hasPro === true ||
        data?.has_pro === true ||
        hasProFromTimestamps(status);
    return status;
}

export async function fetchMyProStatus(groupId?: string | null): Promise<MyProStatus> {
    const { data, error } = await supabase.rpc('get_my_pro_status', {
        p_group_id: groupId ?? null,
    });
    if (error || data == null) {
        return {
            hasPro: false,
            individualProUntil: null,
            groupPassUntil: null,
            includedTripPassCredits: 0,
            unassignedTripPassCount: 0,
        };
    }
    if (typeof data === 'object') {
        return parseStatusRow(data as Record<string, unknown>);
    }
    return {
        hasPro: false,
        individualProUntil: null,
        groupPassUntil: null,
        includedTripPassCredits: 0,
        unassignedTripPassCount: 0,
    };
}

export type RedeemIncludedTripPassError =
    | 'not_authenticated'
    | 'not_a_member'
    | 'subscription_inactive'
    | 'no_credit'
    | 'unknown';

export async function redeemIncludedTripPass(
    groupId: string,
): Promise<{ ok: true } | { ok: false; error: RedeemIncludedTripPassError }> {
    const { data, error } = await supabase.rpc('redeem_included_trip_pass', {
        p_group_id: groupId,
    });
    if (error || !data || typeof data !== 'object') {
        return { ok: false, error: 'unknown' };
    }
    const row = data as Record<string, unknown>;
    if (row.ok === true) return { ok: true };
    const code = row.error as RedeemIncludedTripPassError | undefined;
    return { ok: false, error: code ?? 'unknown' };
}

export type TripPassIntentError = 'not_authenticated' | 'not_a_member' | 'unknown';

export async function registerTripPassPurchaseIntent(
    groupId: string,
): Promise<{ ok: true } | { ok: false; error: TripPassIntentError }> {
    const { data, error } = await supabase.rpc('register_trip_pass_purchase_intent', {
        p_group_id: groupId,
    });
    if (error || !data || typeof data !== 'object') {
        return { ok: false, error: 'unknown' };
    }
    const row = data as Record<string, unknown>;
    if (row.ok === true) return { ok: true };
    const code = row.error as TripPassIntentError | undefined;
    return { ok: false, error: code ?? 'unknown' };
}

export type AssignPurchasedTripPassError =
    | 'not_authenticated'
    | 'not_a_member'
    | 'no_unassigned_pass'
    | 'unknown';

/** Persist trial end for server-side reminder dispatch when local scheduling fails. */
export async function registerProTrialReminderOnServer(trialEndsAtIso: string | null): Promise<void> {
    const { error } = await supabase.rpc('register_pro_trial_reminder', {
        p_trial_ends_at: trialEndsAtIso,
    });
    if (error) {
        console.warn('register_pro_trial_reminder failed', error.message);
    }
}

export async function assignPurchasedTripPass(
    groupId: string,
): Promise<{ ok: true } | { ok: false; error: AssignPurchasedTripPassError }> {
    const { data, error } = await supabase.rpc('assign_purchased_trip_pass', {
        p_group_id: groupId,
    });
    if (error || !data || typeof data !== 'object') {
        return { ok: false, error: 'unknown' };
    }
    const row = data as Record<string, unknown>;
    if (row.ok === true) return { ok: true };
    const code = row.error as AssignPurchasedTripPassError | undefined;
    return { ok: false, error: code ?? 'unknown' };
}
