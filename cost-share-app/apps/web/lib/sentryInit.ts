import * as Sentry from '@sentry/nextjs';
import { webSentryReleaseMetadata } from './sentryRelease';

/** Shared Sentry.init options for Next.js server, edge, and browser runtimes. */
export function initWebSentry(): void {
    const environment = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? 'development';
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
    const { release, dist } = webSentryReleaseMetadata();

    Sentry.init({
        dsn,
        enabled: Boolean(dsn),
        environment,
        release,
        dist,
        // Release Health (#427): @sentry/nextjs tracks browser sessions by default when DSN is set.
        tracesSampleRate: environment === 'production' ? 0.2 : 1.0,
        sendDefaultPii: false,
    });
}
