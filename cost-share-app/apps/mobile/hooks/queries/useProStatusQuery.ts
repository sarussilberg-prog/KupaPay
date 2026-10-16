import { useProStatus } from '../useProStatus';

/** @deprecated Use `useProStatus` — same behavior, single Pro source of truth. */
export function useProStatusQuery(groupId?: string | null) {
    return useProStatus(groupId);
}
