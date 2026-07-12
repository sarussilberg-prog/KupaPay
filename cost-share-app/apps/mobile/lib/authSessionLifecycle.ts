import { AppState, type AppStateStatus } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { authStorage } from './authStorage';
import { wipePersistedCache } from './persistQueryClient';

let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

/**
 * How long to wait for Supabase to surface the persisted session before we read
 * it from storage ourselves. Offline cold-starts with an expired access token
 * block both INITIAL_SESSION and getSession() on a network token-refresh that
 * retries with backoff for ~30s (and never settles on a hanging network), which
 * would otherwise strand the app on the native splash. See hydrateAuthSession.
 */
const HYDRATE_HARD_DEADLINE_MS = 3500;

/**
 * Supabase persists the session under `sb-<project-ref>-auth-token`, where the
 * ref is the first label of the API hostname. We mirror that derivation so we
 * can read the stored session directly — without triggering the network
 * token-refresh that getSession() performs for an expired token.
 */
export function supabaseAuthStorageKey(): string | null {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (!url) return null;
    try {
        const ref = new URL(url).hostname.split('.')[0];
        return ref ? `sb-${ref}-auth-token` : null;
    } catch {
        return null;
    }
}

/**
 * Reads the persisted Supabase session straight from storage, bypassing the
 * auth client (and the network refresh it may attempt). Returns null when no
 * usable session is stored. The returned access token may be expired — that's
 * fine on cold-boot 'hydration', where the app fails-open offline and
 * autoRefresh renews the token once connectivity returns.
 */
export async function readPersistedSession(): Promise<Session | null> {
    try {
        const key = supabaseAuthStorageKey();
        if (!key) return null;
        const raw = await authStorage.getItem(key);
        if (!raw) return null;
        const session = JSON.parse(raw) as Partial<Session> | null;
        if (session && typeof session.access_token === 'string' && session.user) {
            return session as Session;
        }
        return null;
    } catch {
        return null;
    }
}

/** True when the server no longer recognizes the persisted refresh token. */
export function isInvalidRefreshTokenError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const message = 'message' in error ? String((error as { message?: unknown }).message) : '';
    return /invalid refresh token|refresh token not found|refresh_token_not_found/i.test(message);
}

/** Clears a broken local session without calling the auth API. */
export async function clearStaleAuthSession(): Promise<void> {
    await supabase.auth.signOut({ scope: 'local' });
    await wipePersistedCache();
}

function syncAutoRefresh(appState: AppStateStatus) {
    if (appState === 'active') {
        void supabase.auth.startAutoRefresh();
        return;
    }

    void supabase.auth.stopAutoRefresh();
}

/** Keeps Supabase access tokens fresh while the app is foregrounded. */
export function setupSupabaseAuthAutoRefresh(): void {
    if (appStateSubscription) return;

    syncAutoRefresh(AppState.currentState);
    appStateSubscription = AppState.addEventListener('change', syncAutoRefresh);
}

export function teardownSupabaseAuthAutoRefresh(): void {
    appStateSubscription?.remove();
    appStateSubscription = null;
    void supabase.auth.stopAutoRefresh();
}

/**
 * Waits for Supabase to hydrate the persisted session from storage before routing.
 * Prefers INITIAL_SESSION; falls back to getSession() for older clients.
 */
export function hydrateAuthSession(): Promise<Session | null> {
    return new Promise((resolve) => {
        let settled = false;
        let subscription: { unsubscribe: () => void } | null = null;

        const finish = (session: Session | null) => {
            if (settled) return;
            settled = true;
            subscription?.unsubscribe();
            clearTimeout(timeoutId);
            clearTimeout(deadlineId);
            resolve(session);
        };

        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'INITIAL_SESSION') {
                queueMicrotask(() => finish(session));
            }
        });
        subscription = authSubscription;

        const timeoutId = setTimeout(() => {
            void supabase.auth.getSession().then(({ data: { session }, error }) => {
                if (error && isInvalidRefreshTokenError(error)) {
                    void clearStaleAuthSession().then(() => finish(null));
                    return;
                }
                finish(session);
            });
        }, 2500);

        // Hard deadline: getSession() above can block indefinitely offline (it
        // performs a network token-refresh for an expired access token). Read
        // the stored session directly so boot never hangs on the splash and
        // returning users stay signed in offline.
        const deadlineId = setTimeout(() => {
            void readPersistedSession().then(finish);
        }, HYDRATE_HARD_DEADLINE_MS);
    });
}
