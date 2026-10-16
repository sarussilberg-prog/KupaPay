/**
 * Persists a group/friend invite across fresh install → first sign-in (deferred deep link).
 * Stores { kind, token } from Universal Links, custom scheme, or deferred attribution
 * (clipboard / Play Install Referrer) on first launch after install.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PendingInvite } from '@cost-share/shared';
import { isValidInviteToken } from './inviteToken';

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
            isValidInviteToken(parsed.token)
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
