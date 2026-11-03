/** CI layout probes: static Groups/tab data — no Supabase or PostHog network. */
export function isE2eLayoutFixturesEnabled(): boolean {
    return process.env.EXPO_PUBLIC_E2E_FIXTURES === '1';
}
