import * as Sentry from '@sentry/nextjs';
import { initWebSentry } from './lib/sentryInit';

export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs' || process.env.NEXT_RUNTIME === 'edge') {
        initWebSentry();
    }
}

export const onRequestError = Sentry.captureRequestError;
