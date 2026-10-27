/**
 * Resolves the "effective" favorite group id: the group the Favorite Group tab
 * should open on. Kept pure (no React, no store) so it is trivially unit-tested.
 *
 * Rules:
 *  - No groups → null (caller shows the empty state).
 *  - Stored id present AND still in the list → use it (even if archived; the
 *    user explicitly pinned it).
 *  - Otherwise fall back to the FIRST group in the same order GroupsListScreen
 *    shows: default sort ('recentDesc' = newest updatedAt first) with archived
 *    groups pushed to the end. If every group is archived, the first archived
 *    one is used rather than returning null.
 */
import { GroupWithMembers } from '@cost-share/shared';
import { isGroupArchived, sortGroups } from './groupListQuery';

export function isKnownGroupId(
    groupId: string | undefined | null,
    groups: GroupWithMembers[],
): groupId is string {
    return Boolean(groupId && groups.some((g) => g.id === groupId));
}

/**
 * Resolves the group context for Add Expense: honor an explicit route/context id
 * when it is still in the user's list, otherwise fall back to the effective
 * favorite (same rules as the Favorite Group tab).
 */
export function resolveAddExpenseGroupId(input: {
    routeGroupId: string | undefined;
    favoriteGroupId: string | null;
    groups: GroupWithMembers[];
}): string | undefined {
    const { routeGroupId, favoriteGroupId, groups } = input;
    if (isKnownGroupId(routeGroupId, groups)) return routeGroupId;
    const fallback = resolveFavoriteGroupId(favoriteGroupId, groups);
    return fallback ?? undefined;
}

export function resolveFavoriteGroupId(
    storedId: string | null,
    groups: GroupWithMembers[],
): string | null {
    if (groups.length === 0) return null;

    if (storedId && groups.some((g) => g.id === storedId)) {
        return storedId;
    }

    // Same ordering as the groups list: default sort, archived last.
    const ordered = sortGroups(groups, 'recentDesc', {});
    const firstActive = ordered.find((g) => !isGroupArchived(g));
    return (firstActive ?? ordered[0]).id;
}
