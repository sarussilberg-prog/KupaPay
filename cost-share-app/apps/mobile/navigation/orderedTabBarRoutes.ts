/**
 * Visual tab order for CustomTabBar (navigator `state.routes` / indices unchanged).
 * Hebrew: Profile and Activity were reversed visually when the bar used row-reverse;
 * swap them in RTL so Profile stays the start-side tab (groupsLayoutDiagnostics
 * `tabbar-profile-leftmost-rtl`).
 */
export function orderedTabBarRoutes<T extends { name: string }>(
    routes: readonly T[],
    isRtl: boolean,
): T[] {
    const ordered = [...routes];
    if (!isRtl) return ordered;

    const profileIdx = ordered.findIndex((r) => r.name === 'Profile');
    const activityIdx = ordered.findIndex((r) => r.name === 'Activity');
    if (profileIdx < 0 || activityIdx < 0) return ordered;

    [ordered[profileIdx], ordered[activityIdx]] = [
        ordered[activityIdx],
        ordered[profileIdx],
    ];
    return ordered;
}
