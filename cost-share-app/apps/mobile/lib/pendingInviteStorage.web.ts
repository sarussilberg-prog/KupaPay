/**
 * Web: sessionStorage is sufficient for pre-auth invite capture (tab-scoped).
 */

import type { PendingInvite } from '@cost-share/shared';
import { isValidInviteToken } from './inviteToken';

const STORAGE_KEY = 'kupapay.pending_invite.v1';

function parsePayload(raw: string | null): PendingInvite | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as PendingInvite;
        if (
            (parsed.kind === 'friend' ||
                parsed.kind === 'group' ||
                parsed.kind === 'expenseShare') &&
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

export async function persistPendingInvite(invite: PendingInvite): Promise<void> {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(invite));
}

export async function loadPersistedPendingInvite(): Promise<PendingInvite | null> {
    if (typeof sessionStorage === 'undefined') return null;
    return parsePayload(sessionStorage.getItem(STORAGE_KEY));
}

export async function clearPersistedPendingInvite(): Promise<void> {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.removeItem(STORAGE_KEY);
}
