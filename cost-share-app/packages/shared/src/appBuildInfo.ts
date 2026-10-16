import { APP_VERSION } from './version';

export type DeployEnvironmentLabel = 'dev' | 'prod';

export type AppBuildInfo = {
    version: string;
    buildNumber: string | null;
    commitSha: string | null;
    environment: DeployEnvironmentLabel;
};

export type AppBuildInfoInput = {
    version?: string;
    buildNumber?: string | number | null;
    commitSha?: string | null;
    environment?: DeployEnvironmentLabel | string | null;
};

/** Map Sentry / runtime env strings to a short dev|prod label for settings UI. */
export function normalizeDeployEnvironment(raw: string | null | undefined): DeployEnvironmentLabel {
    const v = (raw ?? '').trim().toLowerCase();
    if (v === 'production' || v === 'prod') return 'prod';
    return 'dev';
}

export function shortCommitSha(sha: string | null | undefined): string | null {
    const s = (sha ?? '').trim();
    if (!s) return null;
    return s.slice(0, 7);
}

export function formatBuildNumber(buildNumber: string | number | null | undefined): string | null {
    if (buildNumber === null || buildNumber === undefined) return null;
    const s = String(buildNumber).trim();
    return s.length ? s : null;
}

export function resolveAppBuildInfo(input: AppBuildInfoInput = {}): AppBuildInfo {
    return {
        version: input.version?.trim() || APP_VERSION,
        buildNumber: formatBuildNumber(input.buildNumber ?? null),
        commitSha: shortCommitSha(input.commitSha),
        environment: normalizeDeployEnvironment(input.environment),
    };
}

/** Lines for settings footer (mobile + web). */
export function formatAppBuildInfoLines(info: AppBuildInfo): string[] {
    const lines: string[] = [`Version ${info.version}`];
    if (info.buildNumber) {
        lines.push(`Build ${info.buildNumber}`);
    }
    if (info.commitSha) {
        lines.push(`Commit ${info.commitSha}`);
    }
    lines.push(info.environment === 'prod' ? 'Environment prod' : 'Environment dev');
    return lines;
}

export function formatAppBuildInfoSingleLine(info: AppBuildInfo): string {
    return formatAppBuildInfoLines(info).join(' · ');
}
