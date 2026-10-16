import * as Sentry from '@sentry/react-native';
import { sentryReleaseMetadata } from './sentryRelease';
import { sentryTracesSampleRate } from './sentryTracesSampleRate';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() || undefined;
const environment = process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? 'development';
const { release, dist } = sentryReleaseMetadata();

export const navigationIntegration = Sentry.reactNavigationIntegration({
    enableTimeToInitialDisplay: true,
});

const reactNativeTracingIntegration = Sentry.reactNativeTracingIntegration();

Sentry.init({
    dsn,
    enabled: !!dsn,
    environment,
    release,
    dist,
    /** Release Health → crash-free sessions (target ≥99.5%, #427). */
    enableAutoSessionTracking: true,
    sendDefaultPii: false,
    sampleRate: 1.0,
    tracesSampleRate: sentryTracesSampleRate(environment),
    enableAutoPerformanceTracing: true,
    attachStacktrace: true,
    integrations: [reactNativeTracingIntegration, navigationIntegration],
});
