/**
 * useSimplifiedDebts — the one balance hook.
 *
 * Every UI surface that shows a debt number reads from `data` returned here.
 * Two surfaces disagreeing is a bug in deriveSimplifiedDebts, not a
 * "different RPC" mismatch.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    deriveSimplifiedDebts,
    SimplifiedDebts,
} from '@cost-share/shared';
import { fetchSimplifiedInputs } from '../services/simplifiedDebts.service';
import { useAppStore } from '../store';
import { queryKeys } from './queries/keys';

const STALE_MS = 60 * 1000;

export function useSimplifiedDebts(): {
    data: SimplifiedDebts | undefined;
    isLoading: boolean;
    isError: boolean;
} {
    const currentUserId = useAppStore(s => s.currentUser?.id ?? '');
    const query = useQuery({
        queryKey: queryKeys.simplifiedDebts,
        queryFn: fetchSimplifiedInputs,
        enabled: Boolean(currentUserId),
        staleTime: STALE_MS,
    });
    const data = useMemo(() => {
        if (!query.data || !currentUserId) return undefined;
        return deriveSimplifiedDebts(query.data, currentUserId);
    }, [query.data, currentUserId]);
    return { data, isLoading: query.isLoading, isError: query.isError };
}
