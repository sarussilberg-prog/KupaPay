/** Performance trace sampling: full capture in non-production, 20% in production. */
export function sentryTracesSampleRate(environment: string | undefined): number {
    const env = (environment ?? 'development').toLowerCase();
    return env === 'production' ? 0.2 : 1.0;
}
