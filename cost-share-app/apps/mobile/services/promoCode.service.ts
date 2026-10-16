import { supabase } from '../lib/supabase';

export type PromoRedeemErrorCode =
    | 'not_authenticated'
    | 'promo_invalid'
    | 'promo_inactive'
    | 'promo_expired'
    | 'promo_max_uses'
    | 'promo_already_redeemed'
    | 'promo_rate_limit_exceeded'
    | 'unknown';

export type PromoRedeemResult =
    | { ok: true; proUntil: string; durationDays: number }
    | { ok: false; code: PromoRedeemErrorCode };

function mapRedeemError(message: string): PromoRedeemErrorCode {
    if (message.includes('not_authenticated')) return 'not_authenticated';
    if (message.includes('promo_already_redeemed')) return 'promo_already_redeemed';
    if (message.includes('promo_inactive')) return 'promo_inactive';
    if (message.includes('promo_expired')) return 'promo_expired';
    if (message.includes('promo_max_uses')) return 'promo_max_uses';
    if (message.includes('promo_rate_limit_exceeded')) return 'promo_rate_limit_exceeded';
    if (message.includes('promo_invalid')) return 'promo_invalid';
    return 'unknown';
}

export async function redeemKupaPayPromoCode(code: string): Promise<PromoRedeemResult> {
    const trimmed = code.trim();
    if (trimmed.length < 4) {
        return { ok: false, code: 'promo_invalid' };
    }

    const { data, error } = await supabase.rpc('redeem_promo_code', { p_code: trimmed });
    if (error) {
        console.warn('redeem_promo_code failed', error);
        return { ok: false, code: mapRedeemError(error.message ?? '') };
    }

    const payload = data as {
        ok?: boolean;
        redemption_id?: string;
        pro_until?: string;
        duration_days?: number;
    } | null;

    if (!payload?.ok || !payload.pro_until) {
        return { ok: false, code: 'unknown' };
    }

    if (payload.redemption_id) {
        void supabase.functions.invoke('promo-code-redeem', {
            body: { redemption_id: payload.redemption_id },
        });
    }

    return {
        ok: true,
        proUntil: payload.pro_until,
        durationDays: payload.duration_days ?? 0,
    };
}
