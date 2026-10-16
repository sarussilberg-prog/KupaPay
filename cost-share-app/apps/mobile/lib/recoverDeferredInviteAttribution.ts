import * as Application from 'expo-application';
import * as Clipboard from 'expo-clipboard';
import {
    parseDeferredInviteClipboard,
    parsePlayInstallReferrer,
    type DeferredInvitePayload,
    type PendingInvite,
} from '@cost-share/shared';
import { Platform } from 'react-native';
import { isValidInviteToken } from './inviteToken';
import {
    hasCheckedDeferredInviteAttribution,
    markDeferredInviteAttributionChecked,
} from './deferredAttributionStorage';
import { persistPendingInvite } from './pendingInviteStorage';

function toPendingInvite(payload: DeferredInvitePayload): PendingInvite {
    return { kind: payload.kind, token: payload.token };
}

function normalizePayload(payload: DeferredInvitePayload | null): PendingInvite | null {
    if (!payload || !isValidInviteToken(payload.token)) return null;
    return toPendingInvite(payload);
}

async function readAndroidInstallReferrer(): Promise<PendingInvite | null> {
    if (Platform.OS !== 'android') return null;
    try {
        const raw = await Application.getInstallReferrerAsync();
        return normalizePayload(parsePlayInstallReferrer(raw));
    } catch {
        return null;
    }
}

async function readDeferredInviteClipboard(): Promise<PendingInvite | null> {
    try {
        const text = await Clipboard.getStringAsync();
        return normalizePayload(parseDeferredInviteClipboard(text));
    } catch {
        return null;
    }
}

/**
 * One-time per install: recover invite token from Play Install Referrer (Android)
 * or landing-page clipboard (iOS / fallback). Skips when an invite is already pending.
 */
export async function recoverDeferredInviteAttribution(
    alreadyHasPendingInvite: boolean,
): Promise<PendingInvite | null> {
    if (alreadyHasPendingInvite) {
        await markDeferredInviteAttributionChecked();
        return null;
    }
    if (await hasCheckedDeferredInviteAttribution()) {
        return null;
    }

    const fromReferrer = await readAndroidInstallReferrer();
    const fromClipboard = fromReferrer ? null : await readDeferredInviteClipboard();
    const recovered = fromReferrer ?? fromClipboard;

    await markDeferredInviteAttributionChecked();

    if (!recovered) return null;

    await persistPendingInvite(recovered);
    return recovered;
}
