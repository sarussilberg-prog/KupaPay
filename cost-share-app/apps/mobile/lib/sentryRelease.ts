import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { APP_VERSION, sentryReleaseMetadata as buildSentryRelease } from '@cost-share/shared';

/** Sentry `release` / `dist` from internal version + native build number. */
export function sentryReleaseMetadata(): { release?: string; dist?: string } {
    const slug = Constants.expoConfig?.slug ?? 'kupapay';
    const build =
        Application.nativeBuildVersion ??
        Constants.expoConfig?.ios?.buildNumber ??
        Constants.expoConfig?.android?.versionCode?.toString();

    return buildSentryRelease({
        slug,
        version: APP_VERSION,
        buildNumber: build ?? null,
    });
}
