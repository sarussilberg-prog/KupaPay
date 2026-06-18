/**
 * useSimplifiedDebts — the one balance hook.
 *
 * Every UI surface that shows a debt number reads from `data` returned here.
 * Two surfaces disagreeing is a bug in deriveSimplifiedDebts, not a
 * "different RPC" mismatch.
 */

import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    deriveSimplifiedDebts,
    SimplifiedDebts,
} from '@cost-share/shared';
import { fetchSimplifiedInputs } from '../services/simplifiedDebts.service';
import { captureError } from '../lib/captureError';
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

    // Protection: a non-empty `unbalanced` means a (group, currency) ledger did
    // not sum to zero — upstream data corruption (e.g. an expense whose splits
    // don't add up to its amount). The simplifier deliberately surfaces it
    // instead of swallowing it; alert so it gets fixed and can never silently
    // masquerade as "everyone settled". Keyed by signature → one report per
    // distinct corruption state, not per render.
    const unbalancedSig = data?.unbalanced.length
        ? data.unbalanced
              .map(u => `${u.groupId}:${u.currency}:${u.residual}`)
              .sort()
              .join('|')
        : '';
    useEffect(() => {
        if (!unbalancedSig) return;
        captureError(new Error('Unbalanced ledger in simplified debts'), {
            tags: { area: 'balances', kind: 'unbalanced_ledger' },
            extra: { unbalanced: data?.unbalanced },
        });
        // `data` intentionally omitted: `unbalancedSig` is the stable trigger.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unbalancedSig]);

    return { data, isLoading: query.isLoading, isError: query.isError };
}
