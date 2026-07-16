/**
 * Resolve which group the center "+" should open AddExpense for.
 * Prefer the group currently being viewed; never rely on a second Zustand store.
 */
import type { NavigationState, PartialState } from '@react-navigation/native';
import { useAppStore } from '../store';
import { queryClient } from '../lib/queryClient';
import { queryKeys } from '../hooks/queries/keys';

type NestedState = NavigationState | PartialState<NavigationState> | undefined;

function focusedRoute(
    state: NestedState,
): { name?: string; params?: Record<string, unknown>; state?: NestedState } | undefined {
    if (!state?.routes?.length) return undefined;
    const index = state.index ?? state.routes.length - 1;
    return state.routes[index] as {
        name?: string;
        params?: Record<string, unknown>;
        state?: NestedState;
    };
}

/** Walk nested state for a GroupDetail (or deeper) groupId. */
export function groupIdFromGroupsTabState(nestedState: NestedState): string | undefined {
    let current = focusedRoute(nestedState);
    while (current) {
        if (
            current.name === 'GroupDetail' ||
            current.name === 'ExpenseDetail' ||
            current.name === 'ExpenseList' ||
            current.name === 'Balances' ||
            current.name === 'SettleUpList' ||
            current.name === 'SettlementHistory' ||
            current.name === 'GroupMembers' ||
            current.name === 'GroupNote' ||
            current.name === 'EditGroup'
        ) {
            const groupId = current.params?.groupId;
            if (typeof groupId === 'string' && groupId.length > 0) return groupId;
        }
        current = focusedRoute(current.state);
    }
    return undefined;
}

export function resolveQuickAddGroupId(input: {
    tabState: NavigationState | undefined;
    favoriteGroupId: string | null | undefined;
    groups: Array<{ id: string }>;
}): string | undefined {
    const { tabState, favoriteGroupId, groups } = input;
    if (!tabState?.routes?.length) {
        return favoriteGroupId ?? groups[0]?.id;
    }

    const focused = focusedRoute(tabState);
    const focusedTab = focused?.name;

    if (focusedTab === 'Groups') {
        const fromGroups = groupIdFromGroupsTabState(focused?.state);
        if (fromGroups) return fromGroups;
    }

    if (focusedTab === 'FavoriteGroup') {
        const nested = focusedRoute(focused?.state);
        const fromParams = nested?.params?.groupId;
        if (typeof fromParams === 'string' && fromParams.length > 0) {
            return fromParams;
        }
        if (favoriteGroupId) return favoriteGroupId;
    }

    return favoriteGroupId ?? groups[0]?.id;
}

export function useQuickAddGroupId(
    tabState: NavigationState | undefined,
): string | undefined {
    const favoriteGroupId = useAppStore((s) => s.favoriteGroupId);
    const groups =
        queryClient.getQueryData<Array<{ id: string }>>(queryKeys.groups) ?? [];
    return resolveQuickAddGroupId({ tabState, favoriteGroupId, groups });
}
