'use client';

import { APP_VERSION, formatAppBuildInfoLines, resolveAppBuildInfo } from '@cost-share/shared';

/** Settings-style build metadata for the marketing web app (mirrors mobile footer). */
export function AppBuildInfoFooter() {
    const commitSha = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? null;
    const info = resolveAppBuildInfo({
        version: process.env.NEXT_PUBLIC_APP_VERSION ?? APP_VERSION,
        buildNumber: commitSha,
        commitSha,
        environment: process.env.NEXT_PUBLIC_KUPAPAY_ENV ?? process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
    });
    const lines = formatAppBuildInfoLines(info);

    return (
        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 12, color: '#9ca3af', lineHeight: 1.6 }}>
            {lines.map(line => (
                <div key={line}>{line}</div>
            ))}
        </div>
    );
}
