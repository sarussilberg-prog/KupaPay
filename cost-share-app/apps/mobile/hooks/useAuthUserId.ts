import { useAppStore } from '../store';

/**
 * Authenticated user id for query `enabled` gates.
 * Prefer hydrated `currentUser`, fall back to the Supabase session id when
 * profile hydration is still in flight (common on slow web cold-starts).
 */
export function useAuthUserId(): string | undefined {
    const fromProfile = useAppStore(s => s.currentUser?.id);
    const fromSession = useAppStore(s => s.session?.user?.id);
    return fromProfile ?? fromSession ?? undefined;
}
