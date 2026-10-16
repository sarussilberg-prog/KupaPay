/**
 * Native: persist deferred invite tokens in SecureStore (not AsyncStorage).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { PendingInvite } from '@cost-share/shared';
import { isValidInviteToken } from './inviteToken';

const STORAGE_KEY = 'kupapay.pending_invite.v1';
/** Pre–SecureStore key; migrated once on read then deleted. */
const LEGACY_ASYNC_KEY = '@kupapay/pending_invite_v1';

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
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(invite));
}

export async function loadPersistedPendingInvite(): Promise<PendingInvite | null> {
    let raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) {
        raw = await AsyncStorage.getItem(LEGACY_ASYNC_KEY);
        if (raw) {
            await SecureStore.setItemAsync(STORAGE_KEY, raw);
            await AsyncStorage.removeItem(LEGACY_ASYNC_KEY);
        }
    }
    return parsePayload(raw);
}

export async function clearPersistedPendingInvite(): Promise<void> {
    await SecureStore.deleteItemAsync(STORAGE_KEY).catch(() => undefined);
}
