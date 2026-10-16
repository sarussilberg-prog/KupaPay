import versionData from '../version.json';

export type VersionJson = {
    version: string;
    marketingVersion?: string;
    lastTestFlightInternalVersion?: string;
    lastPlayInternalVersion?: string;
};

const data = versionData as VersionJson;

/** Full internal version (may include `-dev.N` on the dev branch). */
export const APP_VERSION: string = data.version;

/** User-facing store / marketing semver (no `-dev` suffix). */
export const APP_MARKETING_VERSION: string =
    data.marketingVersion?.trim() || stripDevPrerelease(data.version);

export const LAST_TESTFLIGHT_INTERNAL_VERSION: string =
    data.lastTestFlightInternalVersion?.trim() || APP_VERSION;

/** @internal — shared with bump/changelog scripts via duplicate logic in scripts. */
export function stripDevPrerelease(version: string): string {
    const m = /^(\d+\.\d+\.\d+)(?:-dev\.\d+)?$/.exec(version.trim());
    return m ? m[1] : version.trim();
}

const DEV_PRERELEASE_RE = /^(\d+\.\d+\.\d+)-dev\.(\d+)$/;

/** Bump dev prerelease counter; seeds `-dev.1` from a clean marketing semver. */
export function bumpDevPrereleaseVersion(current: string, marketingVersion: string): string {
    const devMatch = DEV_PRERELEASE_RE.exec(current.trim());
    if (devMatch) {
        const next = Number(devMatch[2]) + 1;
        return `${devMatch[1]}-dev.${next}`;
    }
    const base = stripDevPrerelease(current);
    const marketing = marketingVersion.trim() || base;
    return `${marketing}-dev.1`;
}
