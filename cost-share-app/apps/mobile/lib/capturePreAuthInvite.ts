import type { PendingInvite } from '@cost-share/shared';
import { parseIncomingUrl } from '../services/deepLinks.service';
import { isAuthCallbackUrl } from '../services/auth.service';
import { persistPendingInvite } from './pendingInviteStorage';

export function inviteLinkFromUrl(url: string): PendingInvite | null {
    if (!url || isAuthCallbackUrl(url)) return null;
    const link = parseIncomingUrl(url);
    if (link.kind === 'friend' || link.kind === 'group') {
        return { kind: link.kind, token: link.token };
    }
    return null;
}

/** Park invite for post-sign-in redemption (memory + AsyncStorage). */
export async function capturePreAuthInvite(
    url: string,
    setPendingInvite: (invite: PendingInvite | null) => void,
): Promise<boolean> {
    const invite = inviteLinkFromUrl(url);
    if (!invite) return false;
    setPendingInvite(invite);
    await persistPendingInvite(invite);
    return true;
}
