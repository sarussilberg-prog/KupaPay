/**
 * Visual tab order for CustomTabBar (navigator `state.routes` / indices unchanged).
 * Visual order follows navigator routes; CustomTabBar mirrors sides via I18nManager.
 */
export function orderedTabBarRoutes<T extends { name: string }>(
    routes: readonly T[],
    _isRtl: boolean,
): T[] {
    return [...routes];
}
