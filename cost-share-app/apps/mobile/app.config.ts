import type { ConfigContext, ExpoConfig } from 'expo/config';
import versionJson from '../../packages/shared/version.json';

const DEFAULT_POSTHOG_HOST = 'https://eu.i.posthog.com';
const DEFAULT_POSTHOG_KEY = 'phc_umvGfkx4Qoa272QiFeNs9WKe2j6C8HQSJfMpUjkaqmhp';

function applyPostHogPublicDefaults(): void {
    if (process.env.EXPO_PUBLIC_POSTHOG_KEY === undefined && process.env.EXPO_PUBLIC_POSTHOG_API_KEY === undefined) {
        process.env.EXPO_PUBLIC_POSTHOG_KEY = DEFAULT_POSTHOG_KEY;
    }
    if (!process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim()) {
        process.env.EXPO_PUBLIC_POSTHOG_HOST = DEFAULT_POSTHOG_HOST;
    }
}

function applySentryBuildDefaults(): void {
    const token = process.env.SENTRY_AUTH_TOKEN?.trim();
    if (!token) {
        process.env.SENTRY_DISABLE_AUTO_UPLOAD = 'true';
        return;
    }
    delete process.env.SENTRY_DISABLE_AUTO_UPLOAD;
    if (!process.env.SENTRY_ORG?.trim()) {
        process.env.SENTRY_ORG = 'kupay-hb';
    }
    if (!process.env.SENTRY_URL?.trim()) {
        process.env.SENTRY_URL = 'https://de.sentry.io/';
    }
}

// app.json remains the static base for everything (icons, plugins, ios.appleTeamId,
// android intent filters, …). This dynamic config only injects the app version from
// the single source of truth (packages/shared/version.json, also exported as
// APP_VERSION from @cost-share/shared) so the native build, Constants.expoConfig.version,
// and every in-app label can never drift. The `as ExpoConfig` cast acknowledges that
// the required name/slug come from app.json via the spread — no duplicated literals.
export default ({ config }: ConfigContext): ExpoConfig => {
    applyPostHogPublicDefaults();
    applySentryBuildDefaults();

    return {
        ...config,
        version: versionJson.version,
    } as ExpoConfig;
};
