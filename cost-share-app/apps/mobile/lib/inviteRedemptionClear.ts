import type { InviteRedemptionResult } from '../services/deepLinks.service';

/** Keep pending invite when redemption failed (null) so the user can retry after sign-in. */
export function shouldClearPendingInviteAfterRedemption(
    result: InviteRedemptionResult | null,
): boolean {
    return result !== null;
}
