import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPermissionStatus, requestPermission } from '../lib/pushNotifications';
import { syncPushRegistrationOnSignIn } from '../lib/pushRegistrationLifecycle';

const COOLDOWN_KEY = 'push_priming_last_declined_at';
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface PushPromptState {
    status: 'unknown' | 'granted' | 'denied' | 'undetermined';
    showBanner: boolean;
    mode: 'soft-ask' | 'open-settings';
    promptSoftAsk: () => Promise<void>;
    dismiss: () => Promise<void>;
    refresh: () => Promise<void>;
}

export function usePushPermissionPrompt(): PushPromptState {
    const [status, setStatus] = useState<PushPromptState['status']>('unknown');
    const [cooldownPassed, setCooldownPassed] = useState(false);

    const refresh = useCallback(async () => {
        try {
            const s = await getPermissionStatus();
            setStatus(s === 'granted' ? 'granted' : s === 'denied' ? 'denied' : 'undetermined');
            const last = Number((await AsyncStorage.getItem(COOLDOWN_KEY)) ?? 0);
            setCooldownPassed(Date.now() - last > COOLDOWN_MS);
        } catch { /* keep current state on failure */ }
    }, []);

    useEffect(() => { void refresh(); }, [refresh]);

    // Re-check when the app returns to foreground — catches the user enabling
    // notifications in the OS Settings, so the banner disappears without a restart.
    useEffect(() => {
        const sub = AppState.addEventListener('change', (s) => {
            if (s === 'active') void refresh();
        });
        return () => sub.remove();
    }, [refresh]);

    const promptSoftAsk = useCallback(async () => {
        const granted = await requestPermission();
        if (granted) {
            await syncPushRegistrationOnSignIn();
        } else {
            await AsyncStorage.setItem(COOLDOWN_KEY, String(Date.now()));
        }
        await refresh();
    }, [refresh]);

    // Dismissing snoozes the banner for the cooldown window and persists across
    // navigations (otherwise it would re-appear every time the screen remounts).
    const dismiss = useCallback(async () => {
        await AsyncStorage.setItem(COOLDOWN_KEY, String(Date.now()));
        setCooldownPassed(false);
    }, []);

    // Show only for not-yet-granted users who haven't declined/dismissed within the
    // cooldown. Granted users (status === 'granted') never see it.
    const showBanner = (status === 'undetermined' || status === 'denied') && cooldownPassed;
    const mode: 'soft-ask' | 'open-settings' = status === 'denied' ? 'open-settings' : 'soft-ask';

    return { status, showBanner, mode, promptSoftAsk, dismiss, refresh };
}
