/**
 * Pure gate resolution after post-login onboarding flag + groups fetch.
 * See AuthenticatedAppGate (KI-002: fetch errors → create, not main).
 */

export type GroupsGateInput = {
    postOnboardingComplete: boolean;
    groupsCount: number;
    fetchFailed: boolean;
};

export type AuthenticatedGateTarget = 'main' | 'create';

export function resolveAuthenticatedGateTarget(input: GroupsGateInput): AuthenticatedGateTarget {
    if (input.postOnboardingComplete) return 'main';
    if (input.fetchFailed) return 'create';
    return input.groupsCount > 0 ? 'main' : 'create';
}

export function shouldMarkPostOnboardingAfterGroups(input: GroupsGateInput): boolean {
    return !input.postOnboardingComplete && !input.fetchFailed && input.groupsCount > 0;
}

/**
 * Injected effects for {@link runAuthenticatedGate}. Kept abstract (no React
 * Query / storage imports) so the orchestration can be unit-tested without
 * mounting the navigator. `TGroup` is left generic on purpose — the gate only
 * cares about the count, not the shape.
 */
export type AuthenticatedGateDeps<TGroup = unknown> = {
    hasCompletedPostLoginOnboarding: () => Promise<boolean>;
    markPostLoginOnboardingComplete: () => Promise<void>;
    getCachedGroupsCount: () => number;
    isOnline: () => boolean;
    fetchGroups: () => Promise<TGroup[]>;
    seedGroups: (groups: TGroup[]) => void;
};

/**
 * Decide the authenticated landing target ('main' | 'create') and — crucially —
 * make sure the groups cache is seeded BEFORE the navigator mounts.
 *
 * Why the seeding matters: GroupsListScreen is the first route INSIDE the
 * bottom-tab navigator. If it mounts with an empty cache it refetches from
 * scratch and renders the full-screen boot splash *inside* the tabs, leaving the
 * bottom bar visible behind the loading icon. By fetching here (while the gate's
 * own full-screen splash is up) and seeding the result, the navigator mounts
 * with data ready, so that in-tab splash never appears.
 */
export async function runAuthenticatedGate<TGroup = unknown>(
    deps: AuthenticatedGateDeps<TGroup>,
): Promise<AuthenticatedGateTarget> {
    const postOnboardingComplete = await deps.hasCompletedPostLoginOnboarding();

    // Groups already cached (persisted from a previous session) → straight to the
    // app; the navigator mounts with data, so no in-tab loading state shows.
    if (deps.getCachedGroupsCount() > 0) {
        if (!postOnboardingComplete) await deps.markPostLoginOnboardingComplete();
        return 'main';
    }

    // No cached groups + offline → fall through to the app. GroupsListScreen shows
    // its offline empty state (its query is paused, not loading), not a splash.
    if (!deps.isOnline()) return 'main';

    // Online with an empty cache — fetch while the gate keeps its full-screen
    // splash up, then seed the cache so the navigator mounts with groups ready.
    let groupsCount = 0;
    let fetchFailed = false;
    try {
        const groups = await deps.fetchGroups();
        deps.seedGroups(groups);
        groupsCount = groups.length;
    } catch {
        fetchFailed = true;
    }

    const input = { postOnboardingComplete, groupsCount, fetchFailed };
    if (shouldMarkPostOnboardingAfterGroups(input)) {
        await deps.markPostLoginOnboardingComplete();
    }
    return resolveAuthenticatedGateTarget(input);
}
