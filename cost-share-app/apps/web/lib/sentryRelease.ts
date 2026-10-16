import { APP_VERSION, sentryReleaseMetadata as buildSentryRelease } from '@cost-share/shared';

/** Sentry release/dist for the Next.js marketing + proxy site. */
export function webSentryReleaseMetadata(): { release?: string; dist?: string } {
    const version = process.env.NEXT_PUBLIC_APP_VERSION?.trim() || APP_VERSION;
    const build =
        process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.trim() ||
        process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
        null;

    return buildSentryRelease({
        slug: 'kupapay-web',
        version,
        buildNumber: build,
    });
}
