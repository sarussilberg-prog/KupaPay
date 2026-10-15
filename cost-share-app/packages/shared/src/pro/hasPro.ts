/** Client/server-shared Pro entitlement evaluation (timestamps from Supabase). */

export interface ProStatusTimestamps {
    individualProUntil?: Date | string | null;
    groupPassUntil?: Date | string | null;
}

function toMs(v: Date | string | null | undefined): number | null {
    if (v == null) return null;
    const d = v instanceof Date ? v : new Date(v);
    const ms = d.getTime();
    return Number.isFinite(ms) ? ms : null;
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
