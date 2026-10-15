/** PostHog env + defaults (public project key; safe to embed in app config). */

const DEFAULT_HOST = 'https://eu.i.posthog.com';
const DEFAULT_KEY = 'phc_umvGfkx4Qoa272QiFeNs9WKe2j6C8HQSJfMpUjkaqmhp';

function readPostHogKeyEnv(): string | undefined {
    const raw = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
    if (raw === undefined) return undefined;
    const trimmed = raw.trim();
    if (!trimmed || trimmed === 'undefined') return '';
    return trimmed;
}

/** Empty env var disables analytics; unset falls back to the embedded public project key. */
export function getPostHogApiKey(): string | null {
    const fromEnv = readPostHogKeyEnv();
    if (fromEnv === '') return null;
    if (fromEnv === undefined) return DEFAULT_KEY;
    return fromEnv;
}

export function getPostHogHost(): string {
    const hostRaw = process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim();
    const host =
        hostRaw && hostRaw !== 'undefined' ? hostRaw : DEFAULT_HOST;
    return host.replace(/\/$/, '');
}

export function isPostHogConfigured(): boolean {
    return !!getPostHogApiKey();
}
