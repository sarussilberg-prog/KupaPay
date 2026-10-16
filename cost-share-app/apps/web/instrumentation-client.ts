import * as Sentry from '@sentry/nextjs';
import { webSentryReleaseMetadata } from './lib/sentryRelease';

const environment = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? 'development';
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
const { release, dist } = webSentryReleaseMetadata();

Sentry.init({
    dsn,
    enabled: Boolean(dsn),
    environment,
    release,
    dist,
    tracesSampleRate: environment === 'production' ? 0.2 : 1.0,
    sendDefaultPii: false,
});
