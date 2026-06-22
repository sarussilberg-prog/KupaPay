import { supabase } from './supabase';

/**
 * Authenticate the Realtime socket for the current session.
 *
 * supabase-js only calls `realtime.setAuth()` on SIGNED_IN and TOKEN_REFRESHED
 * — NOT on INITIAL_SESSION. On a cold start with a restored session (the common
 * case), only INITIAL_SESSION fires, so the Realtime socket stays
 * unauthenticated and RLS-protected `postgres_changes` (expenses, settlements,
 * activity_events, …) silently deliver nothing until the next token refresh.
 *
 * Call this once we have the boot session so live updates work immediately.
 * Passing the JWT explicitly (vs. the no-arg form) keeps it independent of the
 * accessToken-callback path, which this client doesn't use.
 */
export function syncRealtimeAuth(
    session: { access_token?: string | null } | null | undefined,
): void {
    const token = session?.access_token;
    if (token) {
        void supabase.realtime.setAuth(token);
    } else {
        void supabase.realtime.setAuth();
    }
}
