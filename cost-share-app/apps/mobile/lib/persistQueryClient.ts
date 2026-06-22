import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import {
    persistQueryClient,
    type Persister,
} from '@tanstack/react-query-persist-client';
import * as Application from 'expo-application';
import * as Sentry from '@sentry/react-native';
import SuperJSON from 'superjson';
import { Image as ExpoImage } from 'expo-image';
import { queryClient } from './queryClient';
import { registerAddExpenseMutationDefaults } from '../hooks/mutations/useAddExpenseMutation';
import { resetAvatarPrefetchCache } from '../hooks/useAvatarPrefetcher';
import { SENTRY_TAGS } from './sentryTags';

// Bumped to v2 when we switched the persister serializer to SuperJSON so
// Date objects round-trip correctly through AsyncStorage. v1 caches written
// with raw JSON would deserialize Date fields as strings and break callers
// like `expense.createdAt.getTime()`. The schema-version change ensures any
// existing v1 cache on a user's device is treated as stale by the buster.
export const PERSIST_SCHEMA_VERSION = 'v2';
export const PERSIST_STORAGE_KEY = 'rq-cache.v2';
export const PERSIST_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const PERSIST_ALLOWLIST_PREFIXES = [
    'groups',
    'groupExpenses',
    'groupMessages',
    'groupMembers',
    'groupUsers',
    'groupSettlements',
    'groupPairwiseDebts',
    'group-simplified-debts-by-currency',
    'group-contributions',
    'balanceSummary',
    // The canonical balance hook (useSimplifiedDebts). Persisting it is what
    // lets the group list, profile, and balances screens show real balances
    // offline instead of defaulting every group to a false "settled".
    'simplifiedDebts',
    'dashboard',
    'activity',
    'friends',
    'friend-requests',
] as const;

const ALLOWLIST = new Set<string>(PERSIST_ALLOWLIST_PREFIXES as readonly string[]);

export function shouldDehydrateQueryFactory() {
    return (query: {
        queryKey: readonly unknown[];
        state: { status: string; data?: unknown };
    }) => {
        const head = query.queryKey[0];
        if (!(typeof head === 'string' && ALLOWLIST.has(head))) return false;
        // Persist successful queries. ALSO persist errored queries that still
        // hold last-known-good data: when a refetch fails offline the query goes
        // to status=error but retains its prior data in memory. Dropping it from
        // the snapshot would overwrite the good on-disk cache, so the next cold
        // start offline restores nothing and the user sees "no groups" / false
        // balances until they reconnect. Never persist a data-less query.
        if (query.state.status === 'success') return true;
        if (query.state.status === 'error' && query.state.data !== undefined) return true;
        return false;
    };
}

export function shouldDehydrateMutationFactory() {
    return (mutation: { options: { mutationKey?: readonly unknown[] }; state: { isPaused: boolean } }) => {
        const key = mutation.options.mutationKey;
        if (!key || key.length === 0) return false;
        return key[0] === 'addExpense';
    };
}

/**
 * userId is intentionally NOT part of the buster. User isolation is enforced by
 * calling wipePersistedCache() on both sign-in and sign-out (see authSessionLifecycle
 * and acceptSessionIfAllowed). Keeping the buster session-independent means returning
 * users get an instant restore on every reopen.
 */
export function computePersistBuster(input: { appVersion: string }): string {
    return `${input.appVersion}|${PERSIST_SCHEMA_VERSION}`;
}

let activePersister: Persister | null = null;
let activeUnsubscribe: (() => void) | null = null;

export async function restoreClient(): Promise<void> {
    try {
        // Mutation defaults MUST be registered before persistQueryClient runs.
        // Restored paused mutations need a mutationFn/callbacks to resume —
        // without these defaults, resumePausedMutations() is a silent no-op
        // and the optimistic row sits in cache until something sweeps it.
        registerAddExpenseMutationDefaults(queryClient);

        const appVersion = Application.nativeApplicationVersion ?? '0.0.0';
        const buster = computePersistBuster({ appVersion });

        const rawPersister = createAsyncStoragePersister({
            storage: AsyncStorage,
            key: PERSIST_STORAGE_KEY,
            throttleTime: 1000,
            // SuperJSON preserves Date / Map / Set / BigInt round-trips.
            // Without this, persisted Dates come back as ISO strings and
            // any caller doing `.getTime()` / `.toISOString()` crashes.
            serialize: (data) => SuperJSON.stringify(data),
            deserialize: (data) => SuperJSON.parse(data),
        });

        // Wrap the persister so read/write failures land in Sentry. The
        // underlying persister swallows errors silently by default — F1.
        activePersister = {
            persistClient: async (client) => {
                try {
                    await rawPersister.persistClient(client);
                } catch (err) {
                    Sentry.captureException(err, { tags: { tag: SENTRY_TAGS.CACHE_PERSIST } });
                }
            },
            restoreClient: async () => {
                try {
                    return await rawPersister.restoreClient();
                } catch (err) {
                    Sentry.captureException(err, { tags: { tag: SENTRY_TAGS.CACHE_REHYDRATE } });
                    return undefined;
                }
            },
            removeClient: async () => {
                try {
                    await rawPersister.removeClient();
                } catch (err) {
                    Sentry.captureException(err, { tags: { tag: SENTRY_TAGS.CACHE_PERSIST } });
                }
            },
        };

        const [unsubscribe, restorePromise] = persistQueryClient({
            queryClient,
            persister: activePersister,
            maxAge: PERSIST_MAX_AGE_MS,
            buster,
            dehydrateOptions: {
                shouldDehydrateQuery: shouldDehydrateQueryFactory(),
                shouldDehydrateMutation: shouldDehydrateMutationFactory(),
            },
        });

        activeUnsubscribe = unsubscribe;
        await restorePromise;

        Sentry.addBreadcrumb({
            category: SENTRY_TAGS.CACHE_REHYDRATE,
            level: 'info',
            message: 'cache restored',
            data: { buster },
        });

        // Resume any addExpense mutations that were paused-offline at the time
        // the app was killed. The wire-online effect in App.tsx also triggers
        // resume when the device transitions online — this initial pass covers
        // the case where the device is already online when the app boots, so
        // pending rows from a prior session get sent without waiting for a
        // network state change.
        void queryClient.resumePausedMutations().catch((err) => {
            Sentry.captureException(err, {
                tags: { tag: SENTRY_TAGS.MUTATION_OFFLINE_ADD },
            });
        });
    } catch (err) {
        Sentry.captureException(err, { tags: { tag: SENTRY_TAGS.CACHE_REHYDRATE } });
        // Swallow: a failed rehydrate is recoverable — queries refetch on first use.
    }
}

export async function wipePersistedCache(): Promise<void> {
    try {
        activeUnsubscribe?.();
        activeUnsubscribe = null;
        activePersister = null;
        await AsyncStorage.removeItem(PERSIST_STORAGE_KEY);
        queryClient.clear();
        // Drop the per-session prefetched-avatars Set so the next signed-in
        // user starts fresh and their avatars get prefetched on first sight.
        resetAvatarPrefetchCache();
        // Wipe expo-image's memory + disk cache so user A's friends' faces
        // don't appear when user B signs in on the same device.
        await Promise.all([
            ExpoImage.clearMemoryCache(),
            ExpoImage.clearDiskCache(),
        ]);
    } catch (err) {
        Sentry.captureException(err, { tags: { tag: SENTRY_TAGS.CACHE_PERSIST } });
    }
}
