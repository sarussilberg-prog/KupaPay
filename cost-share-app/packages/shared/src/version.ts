import versionData from '../version.json';

/**
 * App version — the single source of truth for the human-facing version string.
 * The literal lives only in packages/shared/version.json. Consumed by the mobile
 * login + legal screens and the web legal page. The native build version and
 * Constants.expoConfig.version derive from the same file via apps/mobile/app.config.ts.
 */
export const APP_VERSION: string = versionData.version;
