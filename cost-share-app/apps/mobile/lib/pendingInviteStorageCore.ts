import type { PendingInvite } from '@cost-share/shared';
import { isValidInviteToken } from './inviteToken';

export const PENDING_INVITE_STORAGE_KEY = 'kupapay.pending_invite.v1';
export const LEGACY_ASYNC_INVITE_KEY = '@kupapay/pending_invite_v1';

export function parsePendingInvitePayload(raw: string | null): PendingInvite | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as PendingInvite;
        if (
            (parsed.kind === 'friend' ||
                parsed.kind === 'group' ||
                parsed.kind === 'expenseShare' ||
                parsed.kind === 'settleReminder') &&
            typeof parsed.token === 'string' &&
            isValidInviteToken(parsed.token)
        ) {
            return parsed;
        }
    } catch {
        // ignore corrupt payload
    }
    return null;
}
