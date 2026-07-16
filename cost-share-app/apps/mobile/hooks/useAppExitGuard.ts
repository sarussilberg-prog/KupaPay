import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Platform } from 'react-native';
import { rootNavigationRef } from '../lib/rootNavigationRef';

const HISTORY_MARKER = { __kupapayExitGuard: true } as const;

function tryGoBackInApp(): boolean {
    if (!rootNavigationRef.isReady()) return false;
    if (!rootNavigationRef.canGoBack()) return false;
    rootNavigationRef.goBack();
    return true;
}

/**
 * Intercepts system Back so it pops the in-app stack when possible, and otherwise
 * shows a leave confirmation instead of silently exiting (web browser / Android).
 * iOS is a no-op — there is no system back that exits the app.
 */
export function useAppExitGuard() {
    const [exitConfirmVisible, setExitConfirmVisible] = useState(false);
    const allowNextPopRef = useRef(false);

    const cancelExit = useCallback(() => {
        setExitConfirmVisible(false);
    }, []);

    const confirmExit = useCallback(() => {
        setExitConfirmVisible(false);
        if (Platform.OS === 'android') {
            BackHandler.exitApp();
            return;
        }
        if (Platform.OS === 'web' && typeof globalThis.history !== 'undefined') {
            allowNextPopRef.current = true;
            globalThis.history.go(-2);
        }
    }, []);

    useEffect(() => {
        if (Platform.OS === 'android') {
            const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
                if (tryGoBackInApp()) return true;
                setExitConfirmVisible(true);
                return true;
            });
            return () => subscription.remove();
        }

        if (Platform.OS !== 'web') return undefined;
        if (typeof globalThis.history === 'undefined' || typeof globalThis.addEventListener !== 'function') {
            return undefined;
        }

        // Spare entry so the first Back press hits our listener instead of leaving.
        globalThis.history.pushState(HISTORY_MARKER, '', globalThis.location?.href ?? '/');

        const onPopState = () => {
            if (allowNextPopRef.current) {
                allowNextPopRef.current = false;
                return;
            }
            // Neutralize the browser navigation; keep the user on the SPA.
            globalThis.history.pushState(HISTORY_MARKER, '', globalThis.location?.href ?? '/');
            if (tryGoBackInApp()) return;
            setExitConfirmVisible(true);
        };

        globalThis.addEventListener('popstate', onPopState);
        return () => {
            globalThis.removeEventListener('popstate', onPopState);
        };
    }, []);

    return { exitConfirmVisible, cancelExit, confirmExit };
}
