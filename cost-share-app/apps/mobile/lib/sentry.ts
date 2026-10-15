import * as Sentry from '@sentry/react-native';
import { sentryReleaseMetadata } from './sentryRelease';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() || undefined;
const { release, dist } = sentryReleaseMetadata();

export const navigationIntegration = Sentry.reactNavigationIntegration({
    enableTimeToInitialDisplay: false,
});

Sentry.init({
    dsn,
    enabled: !!dsn,
    environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? 'development',
    release,
    dist,
    sendDefaultPii: false,
    sampleRate: 1.0,
    tracesSampleRate: 0.2,
    attachStacktrace: true,
    integrations: [navigationIntegration],
});
