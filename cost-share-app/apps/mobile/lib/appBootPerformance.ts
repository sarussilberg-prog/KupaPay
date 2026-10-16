import * as Sentry from '@sentry/react-native';

const bootStartedAtMs = Date.now();
let bootFinished = false;

/** Call once when App init completes (success or failure). */
export function finishAppBootSpan(): void {
    if (bootFinished) return;
    bootFinished = true;
    const durationMs = Date.now() - bootStartedAtMs;
    Sentry.startSpan(
        {
            name: 'app.boot',
            op: 'app.start',
            attributes: {
                'app.boot.duration_ms': durationMs,
            },
        },
        () => undefined,
    );
}
