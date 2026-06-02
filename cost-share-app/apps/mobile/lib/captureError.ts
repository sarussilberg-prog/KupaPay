import * as Sentry from '@sentry/react-native';

type CaptureContext = {
    tags?: Record<string, string | number | boolean | null | undefined>;
    extra?: Record<string, unknown>;
};

/**
 * Sentry's "Object captured as exception with keys: ..." titles happen when
 * captureException receives a plain object (e.g. a Supabase / Postgrest error)
 * instead of a real Error. Without `.message` or `.stack`, Sentry has nothing
 * to fingerprint on, so every offline insert collides into the same opaque
 * issue.
 *
 * This wrapper normalizes the input to a real Error (preserving the original
 * payload as `extra.originalError`), so the Sentry title shows the actual
 * message and grouping reflects the underlying cause.
 */
export function captureError(err: unknown, context?: CaptureContext): void {
    const normalized = toError(err);
    if (normalized.original === undefined) {
        Sentry.captureException(normalized.error, context);
        return;
    }
    const merged: CaptureContext = {
        ...context,
        extra: { ...(context?.extra ?? {}), originalError: normalized.original },
    };
    Sentry.captureException(normalized.error, merged);
}

function toError(err: unknown): { error: Error; original?: unknown } {
    if (err instanceof Error) return { error: err };
    if (typeof err === 'string') return { error: new Error(err) };
    if (err && typeof err === 'object') {
        const obj = err as Record<string, unknown>;
        const message =
            typeof obj.message === 'string' && obj.message.length > 0
                ? obj.message
                : `Object captured (keys: ${Object.keys(obj).join(', ')})`;
        return { error: new Error(message), original: err };
    }
    return { error: new Error(`Non-error captured: ${String(err)}`) };
}
