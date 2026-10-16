import { APP_VERSION } from './version';

export type SentryReleaseInput = {
    slug: string;
    version?: string;
    buildNumber?: string | number | null;
};

/** Sentry `release` / `dist` from app slug, internal version, and native/build id. */
export function sentryReleaseMetadata(input: SentryReleaseInput): { release?: string; dist?: string } {
    const version = (input.version ?? APP_VERSION).trim();
    if (!version) return {};

    const buildRaw = input.buildNumber;
    const build =
        buildRaw === null || buildRaw === undefined
            ? undefined
            : String(buildRaw).trim() || undefined;

    const slug = input.slug.trim() || 'kupapay';
    const release = build ? `${slug}@${version}+${build}` : `${slug}@${version}`;
    return { release, dist: build };
}
