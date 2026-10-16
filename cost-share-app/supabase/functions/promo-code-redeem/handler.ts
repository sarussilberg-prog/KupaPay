/** Sync RevenueCat promotional Pro after successful redeem_promo_code RPC. */

import { createClient } from 'npm:@supabase/supabase-js@2';

export interface PromoRedeemEnv {
    SUPABASE_URL: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    REVENUECAT_SECRET_API_KEY?: string;
}

export async function grantPromoProDays(
    appUserId: string,
    durationDays: number,
): Promise<{ ok: boolean; error?: string }> {
    const apiKey = Deno.env.get('REVENUECAT_SECRET_API_KEY')?.trim();
    if (!apiKey) {
        return { ok: false, error: 'missing_revenuecat_secret' };
    }
    const days = Math.max(1, Math.min(730, Math.floor(durationDays)));
    const url = `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}/entitlements/pro/promotional`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            duration: 'daily',
            duration_count: days,
        }),
    });
    if (!res.ok) {
        const text = await res.text();
        return { ok: false, error: `rc_${res.status}:${text.slice(0, 160)}` };
    }
    return { ok: true };
}

export async function handlePromoCodeRedeemSync(
    params: { redemptionId: string; userId: string },
    env: PromoRedeemEnv,
): Promise<{ ok: boolean; code?: string; error?: string }> {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
        return { ok: false, code: 'misconfigured' };
    }

    const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
    });

    const { data: rows, error: fetchErr } = await admin.rpc('get_promo_redemption_for_rc_sync', {
        p_redemption_id: params.redemptionId,
        p_user_id: params.userId,
    });

    if (fetchErr || !rows?.length) {
        return { ok: false, code: 'redemption_not_found' };
    }

    const row = rows[0] as { duration_days: number; rc_synced_at: string | null };
    if (row.rc_synced_at) {
        return { ok: true };
    }

    const rc = await grantPromoProDays(params.userId, row.duration_days);
    await admin.rpc('mark_promo_redemption_rc_synced', {
        p_redemption_id: params.redemptionId,
        p_user_id: params.userId,
        p_ok: rc.ok,
        p_error: rc.error ?? null,
    });

    if (!rc.ok) {
        return { ok: false, code: 'rc_sync_failed', error: rc.error };
    }
    return { ok: true };
}
