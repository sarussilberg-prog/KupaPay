import * as Application from 'expo-application';
import Constants from 'expo-constants';

/** Sentry `release` / `dist` from the native app version (EAS build number). */
export function sentryReleaseMetadata(): { release?: string; dist?: string } {
    const slug = Constants.expoConfig?.slug ?? 'kupapay';
    const version = Constants.expoConfig?.version;
    const build =
        Application.nativeBuildVersion ??
        Constants.expoConfig?.ios?.buildNumber ??
        Constants.expoConfig?.android?.versionCode?.toString();

    if (!version) return {};
    const release = build ? `${slug}@${version}+${build}` : `${slug}@${version}`;
    return { release, dist: build ?? undefined };
}
