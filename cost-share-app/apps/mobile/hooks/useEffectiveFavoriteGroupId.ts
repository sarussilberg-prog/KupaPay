/**
 * The effective favorite-group id for the Favorite Group tab: the stored
 * favoriteGroupId if still valid, else the first group in the list (see
 * resolveFavoriteGroupId). Returns null only when the user has no groups.
 */
import { useMemo } from 'react';
import { useAppStore } from '../store';
import { useGroupsQuery } from './queries/useGroupsQuery';
import { resolveFavoriteGroupId } from '../lib/favoriteGroup';

export function useEffectiveFavoriteGroupId(): string | null {
    const storedId = useAppStore((s) => s.favoriteGroupId);
    const { data: groups } = useGroupsQuery();

    return useMemo(
        () => resolveFavoriteGroupId(storedId, groups ?? []),
        [storedId, groups],
    );
}
