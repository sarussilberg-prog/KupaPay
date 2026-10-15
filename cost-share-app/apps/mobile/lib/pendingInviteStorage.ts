/**
 * Persists a group/friend invite across fresh install → first sign-in (deferred deep link).
 * Only stores { kind, token } — no clipboard or third-party attribution SDKs.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PendingInvite } from '@cost-share/shared';

const STORAGE_KEY = '@kupapay/pending_invite_v1';

export async function persistPendingInvite(invite: PendingInvite): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(invite));
}

export async function loadPersistedPendingInvite(): Promise<PendingInvite | null> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as PendingInvite;
        if (
            (parsed.kind === 'friend' || parsed.kind === 'group') &&
            typeof parsed.token === 'string' &&
            parsed.token.length >= 10 &&
            parsed.token.length <= 14 &&
            /^[A-Za-z0-9_-]+$/.test(parsed.token)
        ) {
            return parsed;
        }
    } catch {
        // ignore corrupt payload
    }
    return null;
}

export async function clearPersistedPendingInvite(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
}
