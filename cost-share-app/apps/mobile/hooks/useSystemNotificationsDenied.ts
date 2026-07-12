import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { getPermissionStatus } from '../lib/pushNotifications';

// True only when the OS reports notifications are off in phone settings ('denied').
// 'undetermined' (never asked) stays false so the app's request-on-entry flow runs.
export function useSystemNotificationsDenied(): boolean {
    const [denied, setDenied] = useState(false);

    const refresh = useCallback(async () => {
        try {
            setDenied((await getPermissionStatus()) === 'denied');
        } catch {
            /* keep current state on failure — never wrongly block the user */
        }
    }, []);

    useEffect(() => { void refresh(); }, [refresh]);

    // Re-check on foreground so re-enabling notifications in OS Settings un-greys
    // the row without an app restart.
    useEffect(() => {
        const sub = AppState.addEventListener('change', (s) => {
            if (s === 'active') void refresh();
        });
        return () => sub.remove();
    }, [refresh]);

    return denied;
}
