import { normalizeAmbassadorReferralCode } from '@cost-share/shared';
import { supabase } from '../lib/supabase';
import {
    clearPendingAmbassadorRef,
    loadPendingAmbassadorRef,
    persistPendingAmbassadorRef,
} from '../lib/pendingAmbassadorRefStorage';

export async function captureAmbassadorRefFromUrl(url: string): Promise<boolean> {
    try {
        const code = normalizeAmbassadorReferralCode(
            new URL(url).searchParams.get('ref') ?? undefined,
        );
        if (!code) return false;
        await persistPendingAmbassadorRef(code);
        return true;
    } catch {
        return false;
    }
}

export async function claimPendingAmbassadorReferral(): Promise<void> {
    const code = await loadPendingAmbassadorRef();
    if (!code) return;
    const { error } = await supabase.rpc('attribute_ambassador_referral', { p_code: code });
    if (!error) {
        await clearPendingAmbassadorRef();
    }
}

export type AmbassadorReferralStats = {
    isAmbassador: boolean;
    referralCode?: string;
    referralCount?: number;
    proUntil?: string;
};

export async function fetchMyAmbassadorReferralStats(): Promise<AmbassadorReferralStats | null> {
    const { data, error } = await supabase.rpc('get_my_ambassador_referral_stats');
    if (error || !data) return null;
    const raw = data as {
        is_ambassador?: boolean;
        referral_code?: string;
        referral_count?: number;
        pro_until?: string;
    };
    return {
        isAmbassador: Boolean(raw.is_ambassador),
        referralCode: raw.referral_code,
        referralCount: raw.referral_count,
        proUntil: raw.pro_until,
    };
}
