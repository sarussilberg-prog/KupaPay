import { type QueryClient, onlineManager } from '@tanstack/react-query';
import * as Sentry from '@sentry/react-native';
import { sweepIfOnline } from './zombieSweep';
import { SENTRY_TAGS } from './sentryTags';

/**
 * After connectivity returns (or when the user taps Retry on the offline banner),
 * resume paused mutations and refetch active queries.
 */
export async function retryConnectivitySync(client: QueryClient): Promise<void> {
    if (!onlineManager.isOnline()) {
        return;
    }
    sweepIfOnline(client);
    try {
        await client.resumePausedMutations();
    } catch (err) {
        Sentry.captureException(err, { tags: { tag: SENTRY_TAGS.MUTATION_OFFLINE_ADD } });
    }
    try {
        await client.invalidateQueries({ refetchType: 'active' });
    } catch (err) {
        Sentry.captureException(err, { tags: { tag: SENTRY_TAGS.NETWORK_TRANSITION } });
    }
}
