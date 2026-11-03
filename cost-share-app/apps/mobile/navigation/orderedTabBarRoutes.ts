/**
 * Visual tab order for CustomTabBar (navigator `state.routes` / indices unchanged).
 * Tab bar rows use explicit LTR layout (`direction: 'ltr'`) so flex is not
 * auto-mirrored; do not swap routes here — #720 removed row-reverse compensation.
 */
export function orderedTabBarRoutes<T extends { name: string }>(
    routes: readonly T[],
    _isRtl: boolean,
): T[] {
    return [...routes];
}
