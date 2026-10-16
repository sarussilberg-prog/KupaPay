import * as Sentry from '@sentry/nextjs';

export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const environment = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? 'development';
        const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
        Sentry.init({
            dsn,
            enabled: Boolean(dsn),
            environment,
            tracesSampleRate: environment === 'production' ? 0.2 : 1.0,
            sendDefaultPii: false,
        });
    }
}
