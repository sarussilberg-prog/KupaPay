/**
 * Native: persist deferred invite tokens in SecureStore (not AsyncStorage).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { PendingInvite } from '@cost-share/shared';
import {
    LEGACY_ASYNC_INVITE_KEY,
    PENDING_INVITE_STORAGE_KEY,
    parsePendingInvitePayload,
} from './pendingInviteStorageCore';

export async function persistPendingInvite(invite: PendingInvite): Promise<void> {
    await SecureStore.setItemAsync(PENDING_INVITE_STORAGE_KEY, JSON.stringify(invite));
}

export async function loadPersistedPendingInvite(): Promise<PendingInvite | null> {
    let raw = await SecureStore.getItemAsync(PENDING_INVITE_STORAGE_KEY);
    if (!raw) {
        raw = await AsyncStorage.getItem(LEGACY_ASYNC_INVITE_KEY);
        if (raw) {
            await SecureStore.setItemAsync(PENDING_INVITE_STORAGE_KEY, raw);
            await AsyncStorage.removeItem(LEGACY_ASYNC_INVITE_KEY);
        }
    }
    return parsePendingInvitePayload(raw);
}

export async function clearPersistedPendingInvite(): Promise<void> {
    try {
        await SecureStore.deleteItemAsync(PENDING_INVITE_STORAGE_KEY);
    } catch {
        // Key missing or secure store unavailable — treat as cleared.
    }
}
