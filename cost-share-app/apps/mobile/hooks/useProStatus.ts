import { useQuery } from '@tanstack/react-query';
import { fetchMyProStatus, type AdminProViewMode, type MyProStatus } from '../services/proEntitlements.service';
import { queryKeys } from './queries/keys';
import { KUPAPAY_PRO_ENABLED } from '../lib/featureFlags';
import { useAppStore } from '../store';

export type { AdminProViewMode, MyProStatus };

export function isAdminProViewOverrideActive(mode: AdminProViewMode | undefined): boolean {
    return mode === 'force_pro' || mode === 'force_free';
}

/**
 * Single source of truth for Pro gating (honors server-side admin view override).
 */
export function useProStatus(groupId?: string | null) {
    const isAdmin = useAppStore((s) => s.currentUser?.isAdmin === true);
    const query = useQuery({
        queryKey: queryKeys.proStatus(groupId ?? undefined),
        queryFn: () => fetchMyProStatus(groupId),
        enabled: KUPAPAY_PRO_ENABLED || isAdmin,
        staleTime: 60_000,
    });

    const mode = query.data?.adminProViewMode ?? 'real';

    return {
        ...query,
        hasPro: query.data?.hasPro === true,
        adminProViewMode: mode,
        adminProViewOverrideActive: isAdminProViewOverrideActive(mode),
        adminProViewExpiresAt: query.data?.adminProViewExpiresAt ?? null,
    };
}
