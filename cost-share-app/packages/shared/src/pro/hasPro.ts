/** Client/server-shared Pro entitlement evaluation (timestamps from Supabase). */

export type AdminProViewMode = 'real' | 'force_pro' | 'force_free';

export interface ProStatusTimestamps {
    individualProUntil?: Date | string | null;
    groupPassUntil?: Date | string | null;
}

export interface ProEntitlementInput {
    hasPro?: boolean;
    adminProViewMode?: AdminProViewMode;
}

function toMs(v: Date | string | null | undefined): number | null {
    if (v == null) return null;
    const d = v instanceof Date ? v : new Date(v);
    const ms = d.getTime();
    return Number.isFinite(ms) ? ms : null;
}

/** Honors admin view override (force_pro / force_free) before real entitlements. */
export function resolveEffectiveHasPro(input: ProEntitlementInput | null | undefined): boolean {
    if (!input) return false;
    if (input.adminProViewMode === 'force_pro') return true;
    if (input.adminProViewMode === 'force_free') return false;
    return input.hasPro === true;
}

export function hasProFromTimestamps(
    status: ProStatusTimestamps,
    now: Date = new Date(),
): boolean {
    const nowMs = now.getTime();
    for (const field of [status.individualProUntil, status.groupPassUntil] as const) {
        const ms = toMs(field);
        if (ms != null && ms > nowMs) return true;
    }
    return false;
}

/** When true, rewarded-ad gates should be skipped (Pro perk). */
export function shouldSkipAdGate(hasPro: boolean, proFeatureEnabled: boolean): boolean {
    return proFeatureEnabled && hasPro;
}

/** Pro perk is usable when the master flag is off (dev) or the user has Pro. */
export function isProPerkUnlocked(hasPro: boolean, proFeatureEnabled: boolean): boolean {
    return !proFeatureEnabled || hasPro;
}
