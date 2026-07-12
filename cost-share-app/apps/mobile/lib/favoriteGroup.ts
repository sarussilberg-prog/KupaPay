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
