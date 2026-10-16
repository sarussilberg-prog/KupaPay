/**
 * Web: sessionStorage is sufficient for pre-auth invite capture (tab-scoped).
 */

import type { PendingInvite } from '@cost-share/shared';
import {
    PENDING_INVITE_STORAGE_KEY,
    parsePendingInvitePayload,
} from './pendingInviteStorageCore';

export async function persistPendingInvite(invite: PendingInvite): Promise<void> {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(PENDING_INVITE_STORAGE_KEY, JSON.stringify(invite));
}

export async function loadPersistedPendingInvite(): Promise<PendingInvite | null> {
    if (typeof sessionStorage === 'undefined') return null;
    return parsePendingInvitePayload(sessionStorage.getItem(PENDING_INVITE_STORAGE_KEY));
}

export async function clearPersistedPendingInvite(): Promise<void> {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.removeItem(PENDING_INVITE_STORAGE_KEY);
}
