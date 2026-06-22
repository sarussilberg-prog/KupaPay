/**
 * Warms the avatar/group images the app already knows about into expo-image's
 * persistent disk cache, so list screens paint instantly and the images are
 * available offline before they're first rendered.
 *
 * expo-image is the source of truth for caching now: every image actually
 * rendered also lands in the same disk cache, so this prefetcher is a
 * best-effort head start, not the only path to offline availability. Single
 * mount at AuthenticatedAppGate; subscribes to the React Query cache + Zustand
 * store and rescans (debounced) on change.
 */

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import type {
    GroupWithMembers,
    User,
    UserDashboard,
} from '@cost-share/shared';
import { useAppStore } from '../store';
import { queryKeys } from './queries/keys';

const DEBOUNCE_MS = 250;

// Per-session set of URLs we've already asked expo-image to prefetch, so a
// burst of cache changes doesn't re-issue the same prefetch repeatedly.
const requested = new Set<string>();

/** Drop the session prefetch set (e.g. on sign-out) so the next user re-warms. */
export function resetAvatarPrefetchCache(): void {
    requested.clear();
}

function collectAvatarUrls(client: ReturnType<typeof useQueryClient>): string[] {
    const urls = new Set<string>();
    const add = (url: string | null | undefined) => {
        if (url) urls.add(url);
    };

    // currentUser (signed-in profile) — held in Zustand, not React Query.
    const me = useAppStore.getState().currentUser;
    add(me?.avatarUrl);

    // Groups list: per-group cover image + each member's avatar.
    const groups =
        client.getQueryData<GroupWithMembers[]>(queryKeys.groups) ?? [];
    for (const g of groups) {
        add(g.imageUrl);
        for (const m of g.members ?? []) add(m.avatarUrl);
    }

    // Per-group user profiles (includes former members).
    const groupUsersQueries = client
        .getQueryCache()
        .findAll({ queryKey: ['groupUsers'] });
    for (const q of groupUsersQueries) {
        const users = q.state.data as User[] | undefined;
        for (const u of users ?? []) add(u.avatarUrl);
    }

    // Dashboard friends.
    const dashboard = client.getQueryData<UserDashboard>(queryKeys.dashboard);
    for (const f of dashboard?.friends ?? []) add(f.avatarUrl);

    // Friends list (`['friends']` key).
    const friendsList = client.getQueryData<
        Array<{ avatarUrl?: string }>
    >(queryKeys.friends);
    for (const f of friendsList ?? []) add(f.avatarUrl);

    return [...urls];
}

function scanAndPrefetch(client: ReturnType<typeof useQueryClient>): void {
    const fresh = collectAvatarUrls(client).filter((url) => !requested.has(url));
    if (fresh.length === 0) return;
    for (const url of fresh) requested.add(url);

    // Fire-and-forget. expo-image dedupes against its own cache; on failure
    // (offline / 404) drop the URLs so a later scan retries them.
    Image.prefetch(fresh, { cachePolicy: 'memory-disk' }).catch(() => {
        for (const url of fresh) requested.delete(url);
    });
}

export function useAvatarPrefetcher(): void {
    const client = useQueryClient();
    useEffect(() => {
        let pending: ReturnType<typeof setTimeout> | null = null;
        const flush = () => {
            pending = null;
            scanAndPrefetch(client);
        };
        const schedule = () => {
            if (pending !== null) return;
            pending = setTimeout(flush, DEBOUNCE_MS);
        };

        // Initial pass covers any data already restored from disk.
        flush();

        const unsubQueryCache = client.getQueryCache().subscribe(schedule);
        const unsubStore = useAppStore.subscribe(schedule);

        return () => {
            if (pending !== null) clearTimeout(pending);
            unsubQueryCache();
            unsubStore();
        };
    }, [client]);
}
