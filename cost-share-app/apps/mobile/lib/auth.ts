import { supabase } from './supabase';
import { clearStaleAuthSession } from './authSessionLifecycle';
import { useAppStore } from '../store';

/**
 * Returns the signed-in Supabase user id, or null if not authenticated.
 *
 * Reads from the locally-stored session (`getSession`) rather than `getUser()`.
 * `getUser()` is a network round-trip that resolves to `null` the moment the
 * device goes offline — which made every balance/query think the user had
 * vanished, fabricating a false "Settled" on every group and evicting the
 * persisted cache. The session id is stored locally and survives airplane mode;
 * the server still enforces real authorization via RLS on each request.
 */
export async function getCurrentUserId(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
}

export type ProfileStatus = 'active' | 'deactivated' | 'missing' | 'unknown';

export const PROFILE_CHECK_TIMEOUT_MS = 8_000;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((resolve) => {
            setTimeout(() => resolve(fallback), ms);
        }),
    ]);
}

async function revokeLocalSession(): Promise<void> {
    await clearStaleAuthSession();
    useAppStore.getState().setSession(null);
}

/**
 * Verifies the signed-in user's profile is active.
 * - 'active'      : profile exists and is_active=true (or no user is signed in).
 * - 'deactivated' : server explicitly reported is_active=false. Side effect: clears the local session.
 * - 'missing'     : signed in but no profile row yet (first-login race with the profile-creation trigger).
 * - 'unknown'     : verification failed (e.g. offline). Caller must NOT treat as deactivated.
 */
export async function assertProfileActive(): Promise<ProfileStatus> {
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError) return 'unknown';
    const user = data?.user;
    if (!user) return 'active';

    const { data: callerActive, error: rpcError } = await supabase.rpc('is_caller_active');

    // is_caller_active() returns false for anon callers as well as deactivated users.
    // When it is false, confirm via the profile row instead of revoking immediately.
    if (!rpcError && callerActive === true) return 'active';
    if (rpcError) {
        console.error('assertProfileActive: is_caller_active RPC failed', rpcError);
    }

    const { data: row, error: rowError } = await supabase
        .from('profiles')
        .select('is_active')
        .eq('id', user.id)
        .maybeSingle();

    if (rowError) {
        console.error('assertProfileActive: profile lookup failed', rowError);
        return 'unknown';
    }
    if (!row) return 'missing';
    if (row.is_active === false) {
        await revokeLocalSession();
        return 'deactivated';
    }
    return 'active';
}

/**
 * Same as assertProfileActive but bounded — prevents the app boot loader from
 * hanging forever when the profile check stalls (common on flaky web networks).
 * Timeouts return 'unknown' so callers can distinguish "can't verify" from
 * "definitively deactivated".
 */
export async function assertProfileActiveWithTimeout(
    timeoutMs = PROFILE_CHECK_TIMEOUT_MS,
): Promise<ProfileStatus> {
    return withTimeout(assertProfileActive(), timeoutMs, 'unknown');
}

/** Returns false only when the server definitively reports the account is deactivated. */
export async function isAuthSessionAllowed(): Promise<boolean> {
    const status = await assertProfileActiveWithTimeout(PROFILE_CHECK_TIMEOUT_MS);
    return status !== 'deactivated';
}
