import { hasProFromTimestamps, type ProStatusTimestamps } from '@cost-share/shared';
import { isAscScreenshotDemo } from '../lib/ascScreenshotDemo';
import {
    mergeProStatusWithStoreEntitlement,
    readActiveProExpirationFromStore,
} from '../lib/proStatusStoreSync';
import { supabase } from '../lib/supabase';
import {
    fetchPurchasesCustomerInfo,
    isPurchasesConfigured,
    waitForPurchasesReady,
} from './purchases.service';

export type AdminProViewMode = 'real' | 'force_pro' | 'force_free';

export interface MyProStatus extends ProStatusTimestamps {
    hasPro: boolean;
    includedTripPassCredits: number;
    unassignedTripPassCount: number;
    adminProViewMode: AdminProViewMode;
    adminProViewExpiresAt: string | null;
}

const CAPTURE_PRO_STATUS: MyProStatus = {
    hasPro: true,
    individualProUntil: '2027-01-15T00:00:00.000Z',
    groupPassUntil: null,
    includedTripPassCredits: 0,
    unassignedTripPassCount: 0,
    adminProViewMode: 'real',
    adminProViewExpiresAt: null,
};

/** @internal Exported for unit tests. */
export function parseProStatusRpcRow(data: Record<string, unknown> | null): MyProStatus {
    const individual = (data?.individualProUntil ?? data?.individual_pro_until) as string | null;
    const groupPass = (data?.groupPassUntil ?? data?.group_pass_until) as string | null;
    const creditsRaw = data?.includedTripPassCredits ?? data?.included_trip_pass_credits;
    const unassignedRaw = data?.unassignedTripPassCount ?? data?.unassigned_trip_pass_count;
    const modeRaw = data?.adminProViewMode ?? data?.admin_pro_view_mode;
    const expiresRaw = data?.adminProViewExpiresAt ?? data?.admin_pro_view_expires_at;
    const adminMode: AdminProViewMode =
        modeRaw === 'force_pro' || modeRaw === 'force_free' ? modeRaw : 'real';

    const status: MyProStatus = {
        individualProUntil: individual ?? null,
        groupPassUntil: groupPass ?? null,
        includedTripPassCredits: typeof creditsRaw === 'number' ? creditsRaw : 0,
        unassignedTripPassCount: typeof unassignedRaw === 'number' ? unassignedRaw : 0,
        adminProViewMode: adminMode,
        adminProViewExpiresAt: typeof expiresRaw === 'string' ? expiresRaw : null,
        hasPro: false,
    };
    if (typeof data?.hasPro === 'boolean' || typeof data?.has_pro === 'boolean') {
        status.hasPro = data?.hasPro === true || data?.has_pro === true;
    } else {
        status.hasPro = hasProFromTimestamps(status);
    }
    return status;
}

/** Server RPC + live RevenueCat entitlement (covers webhook lag after purchase). */
export async function fetchMyProStatusWithStoreSync(
    groupId?: string | null,
): Promise<MyProStatus> {
    const status = await fetchMyProStatus(groupId);
    if (status.adminProViewMode !== 'real') {
        return status;
    }
    if (!isPurchasesConfigured()) {
        return status;
    }
    const ready = await waitForPurchasesReady();
    if (!ready) {
        return status;
    }
    const info = await fetchPurchasesCustomerInfo();
    const storeExpiration = readActiveProExpirationFromStore(
        info as Parameters<typeof readActiveProExpirationFromStore>[0],
    );
    return mergeProStatusWithStoreEntitlement(status, storeExpiration);
}

export async function fetchMyProStatus(groupId?: string | null): Promise<MyProStatus> {
    if (isAscScreenshotDemo()) {
        if (groupId === 'g-barcelona') {
            return {
                ...CAPTURE_PRO_STATUS,
                groupPassUntil: '2026-12-20T00:00:00.000Z',
            };
        }
        return CAPTURE_PRO_STATUS;
    }
    const { data, error } = await supabase.rpc('get_my_pro_status', {
        p_group_id: groupId ?? null,
    });
    if (error) {
        throw error;
    }
    if (data == null) {
        throw new Error('get_my_pro_status returned null');
    }
    if (typeof data === 'object') {
        return parseProStatusRpcRow(data as Record<string, unknown>);
    }
    throw new Error('get_my_pro_status returned unexpected payload');
}

export async function setMyAdminProViewMode(
    mode: AdminProViewMode,
    durationHours = 24,
): Promise<MyProStatus> {
    const { data, error } = await supabase.rpc('set_my_admin_pro_view_mode', {
        p_mode: mode,
        p_duration_hours: durationHours,
    });
    if (error || data == null || typeof data !== 'object') {
        throw error ?? new Error('set_my_admin_pro_view_mode failed');
    }
    return parseProStatusRpcRow(data as Record<string, unknown>);
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
