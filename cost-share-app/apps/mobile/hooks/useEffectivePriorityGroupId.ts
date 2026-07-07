/**
 * The effective priority-group id for the Priority Group tab: the stored
 * priorityGroupId if still valid, else the first group in the list (see
 * resolvePriorityGroupId). Returns null only when the user has no groups.
 */
import { useMemo } from 'react';
import { useAppStore } from '../store';
import { useGroupsQuery } from './queries/useGroupsQuery';
import { resolvePriorityGroupId } from '../lib/priorityGroup';

export function useEffectivePriorityGroupId(): string | null {
    const storedId = useAppStore((s) => s.priorityGroupId);
    const { data: groups } = useGroupsQuery();

    return useMemo(
        () => resolvePriorityGroupId(storedId, groups ?? []),
        [storedId, groups],
    );
}
