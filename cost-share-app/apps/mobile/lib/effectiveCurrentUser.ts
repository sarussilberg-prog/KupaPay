import type { Session } from '@supabase/supabase-js';
import type { User } from '@cost-share/shared';
import { provisionalUserFromSession } from './provisionalUserFromSession';

/**
 * Prefer the hydrated DB profile; fall back to session metadata while hydration
 * is pending or failed (common when profiles RLS regresses on the server).
 */
export function effectiveCurrentUser(
    session: Session | null | undefined,
    currentUser: User | null | undefined,
): User | null {
    if (currentUser?.id) return currentUser;
    if (session?.user?.id) return provisionalUserFromSession(session);
    return null;
}
