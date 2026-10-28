import { getPostHogHost } from './posthogEnv';

/** PostHog app UI host (not ingest). */
function posthogAppHost(): string {
    const ingest = getPostHogHost();
    if (ingest.includes('eu.i.posthog.com')) return 'https://eu.posthog.com';
    if (ingest.includes('us.i.posthog.com')) return 'https://us.posthog.com';
    return ingest.replace('.i.posthog.com', '.posthog.com');
}

/** Optional deep link after dashboard is created in PostHog UI / ensure script. */
export function getPostHogMauDashboardUrl(): string | null {
    const explicit = process.env.EXPO_PUBLIC_POSTHOG_MAU_DASHBOARD_URL?.trim();
    if (explicit) return explicit;

    const projectId = process.env.EXPO_PUBLIC_POSTHOG_PROJECT_ID?.trim();
    const dashboardId = process.env.EXPO_PUBLIC_POSTHOG_MAU_DASHBOARD_ID?.trim();
    if (!projectId) return null;

    const base = `${posthogAppHost()}/project/${projectId}`;
    if (dashboardId) return `${base}/dashboard/${dashboardId}`;
    return `${base}/dashboards`;
}
