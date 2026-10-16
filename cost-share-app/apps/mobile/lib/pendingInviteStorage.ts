/**
 * Persists a group/friend invite across fresh install → first sign-in (deferred deep link).
 * Metro resolves `.native.ts` / `.web.ts` at bundle time; this file satisfies TypeScript.
 */

export {
    persistPendingInvite,
    loadPersistedPendingInvite,
    clearPersistedPendingInvite,
} from './pendingInviteStorage.native';
