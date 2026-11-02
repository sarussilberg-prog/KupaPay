import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../hooks/queries/keys';
import { deferClearAppIconBadge } from './pushNotifications';

type MarkActivitySeenResult = { error: unknown | null };

interface ActivityScreenFocusDeps {
    fetchWatermark: () => Promise<Date | null>;
    markSeen: () => Promise<MarkActivitySeenResult>;
    queryClient: QueryClient;
    clearBadge?: () => void;
}

/**
 * Focus-side effects for ActivityFeedScreen: capture unread divider watermark,
 * mark activity seen server-side, refresh unread query, then clear the app icon
 * badge (deferred + permission-guarded).
 */
export async function runActivityScreenFocusEffects(
    deps: ActivityScreenFocusDeps,
): Promise<Date | null> {
    const watermark = await deps.fetchWatermark();
    const { error } = await deps.markSeen();
    if (!error) {
        void deps.queryClient.invalidateQueries({ queryKey: queryKeys.activityUnreadCount });
        try {
            (deps.clearBadge ?? deferClearAppIconBadge)();
        } catch {
            /* badge defer/native setup failed — non-fatal */
        }
    }
    return watermark;
}
