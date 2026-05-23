import { supabase } from './supabase';

/** Returns the signed-in Supabase user id, or null if not authenticated. */
export async function getCurrentUserId(): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
}

export type ProfileStatus = 'active' | 'deactivated' | 'missing';

const PROFILE_CHECK_TIMEOUT_MS = 8_000;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((resolve) => {
            setTimeout(() => resolve(fallback), ms);
        }),
    ]);
}

/**
 * Verifies the signed-in user's profile is active.
 * - 'active'      : profile exists and is_active=true (or no user is signed in — caller decides what to do).
 * - 'deactivated' : profile exists and is_active=false. Side effect: signs the user out before returning.
 * - 'missing'     : signed in but no profile row yet (first-login race with the profile-creation trigger).
 */
export async function assertProfileActive(): Promise<ProfileStatus> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 'active';

    const { data, error } = await supabase
        .from('profiles')
        .select('is_active')
        .eq('id', user.id)
        .maybeSingle();

    if (error) {
        console.error('assertProfileActive: profile lookup failed', error);
        return 'active'; // Fail-open: don't lock the user out on transient errors.
    }
    if (!data) return 'missing';
    if (data.is_active === false) {
        await supabase.auth.signOut();
        return 'deactivated';
    }
    return 'active';
}

/**
 * Same as assertProfileActive but bounded — prevents the app boot loader from
 * hanging forever when the profile check stalls (common on flaky web networks).
 * Fail-open on timeout, matching the transient-error behaviour above.
 */
export async function assertProfileActiveWithTimeout(
    timeoutMs = PROFILE_CHECK_TIMEOUT_MS,
): Promise<ProfileStatus> {
    return withTimeout(assertProfileActive(), timeoutMs, 'active');
}
