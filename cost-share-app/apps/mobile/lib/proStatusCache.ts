import type { MyProStatus } from '../services/proEntitlements.service';
import { queryClient } from './queryClient';
import { queryKeys } from '../hooks/queries/keys';

const DEFAULT_INDIVIDUAL_UNTIL = () =>
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

function mergeProStatus(prev: MyProStatus | undefined, patch: Partial<MyProStatus>): MyProStatus {
    const base: MyProStatus = prev ?? {
        hasPro: false,
        individualProUntil: null,
        groupPassUntil: null,
        includedTripPassCredits: 0,
        unassignedTripPassCount: 0,
        adminProViewMode: 'real',
        adminProViewExpiresAt: null,
    };
    return {
        ...base,
        ...patch,
        hasPro: patch.hasPro ?? base.hasPro ?? true,
    };
}

/** Immediate UI unlock after native store purchase before webhook/RPC catch up. */
export function applyOptimisticProPurchaseCache(opts: {
    groupId?: string;
    tripPassOnly?: boolean;
    individualUntil?: string | null;
    groupPassUntil?: string | null;
}): void {
    const globalPatch: Partial<MyProStatus> = { hasPro: true };
    if (!opts.tripPassOnly) {
        globalPatch.individualProUntil = opts.individualUntil ?? DEFAULT_INDIVIDUAL_UNTIL();
    }

    queryClient.setQueryData<MyProStatus>(queryKeys.proStatus(), prev =>
        mergeProStatus(prev, globalPatch),
    );

    if (opts.groupId) {
        const groupPatch: Partial<MyProStatus> = { hasPro: true };
        if (opts.tripPassOnly) {
            groupPatch.groupPassUntil =
                opts.groupPassUntil ??
                new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        } else {
            groupPatch.individualProUntil = globalPatch.individualProUntil ?? null;
        }
        queryClient.setQueryData<MyProStatus>(queryKeys.proStatus(opts.groupId), prev =>
            mergeProStatus(prev, groupPatch),
        );
    }
}

export async function refreshProStatusQueries(groupId?: string): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: queryKeys.proStatus() });
    if (groupId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.proStatus(groupId) });
    }
}
