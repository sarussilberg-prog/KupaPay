/** Pro membership labels derived from `get_my_pro_status` timestamps. */

import type { ProStatusTimestamps } from './hasPro';

export type ProMembershipSource = 'none' | 'individual' | 'group_pass' | 'both';

function toMs(v: Date | string | null | undefined): number | null {
    if (v == null) return null;
    const d = v instanceof Date ? v : new Date(v);
    const ms = d.getTime();
    return Number.isFinite(ms) ? ms : null;
}

export function isIndividualProActive(
    status: ProStatusTimestamps,
    now: Date = new Date(),
): boolean {
    const ms = toMs(status.individualProUntil);
    return ms != null && ms > now.getTime();
}

export function isGroupPassActive(
    status: ProStatusTimestamps,
    now: Date = new Date(),
): boolean {
    const ms = toMs(status.groupPassUntil);
    return ms != null && ms > now.getTime();
}

/** Which entitlement timestamps are currently active (for UI copy). */
export function resolveProMembershipSource(
    status: ProStatusTimestamps,
    now: Date = new Date(),
): ProMembershipSource {
    const individual = isIndividualProActive(status, now);
    const group = isGroupPassActive(status, now);
    if (individual && group) return 'both';
    if (individual) return 'individual';
    if (group) return 'group_pass';
    return 'none';
}
