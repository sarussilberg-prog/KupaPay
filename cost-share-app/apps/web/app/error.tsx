'use client';

/** Route-level error UI (#427). Unhandled errors still reach Sentry via instrumentation. */
export default function GlobalRouteError({
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <main style={{ maxWidth: 480, margin: '4rem auto', padding: '0 1.5rem', fontFamily: 'system-ui' }}>
            <h1 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>Something went wrong</h1>
            <p style={{ color: '#475569', marginBottom: '1.5rem' }}>
                This page hit an unexpected error. You can try again.
            </p>
            <button
                type="button"
                onClick={() => reset()}
                style={{
                    padding: '0.5rem 1rem',
                    borderRadius: 8,
                    border: 'none',
                    background: '#2563eb',
                    color: '#fff',
                    cursor: 'pointer',
                }}
            >
                Try again
            </button>
        </main>
    );
}
