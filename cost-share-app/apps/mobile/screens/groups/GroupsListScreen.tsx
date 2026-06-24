/**
 * GroupsListScreen
 * Main groups list with expandable search, filter/sort sheet,
 * per-group balance chips, and a floating bottom create-group CTA.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    FlatList,
    RefreshControl,
    TouchableOpacity,
    TextInput,
    ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute } from '@react-navigation/native';
import { GroupWithMembers } from '@cost-share/shared';
import { useGroupsQuery } from '../../hooks/queries/useGroupsQuery';
import { queryClient } from '../../lib/queryClient';
import { queryKeys } from '../../hooks/queries/keys';
import { prefetchActivityFeed } from '../../hooks/queries/useActivityQuery';
import { prefetchGroupDetail } from '../../hooks/queries/prefetchGroupDetail';
import { prefetchAddExpensePrerequisitesForGroup } from '../../hooks/queries/prefetchAddExpenseForAllGroups';
import { useSimplifiedDebts } from '../../hooks/useSimplifiedDebts';
import { useNetworkStatus } from '../../lib/networkStatus';
import { resolveEmptyStateVariant } from '../../lib/offlineEmptyState';
import { EmptyState } from '../../components/EmptyState';
import { GroupCard } from '../../components/GroupCard';
import { CreateGroupFabAnchor, createGroupFabScrollPadding } from '../../components/groups/CreateGroupFabAnchor';
import { CreateGroupFloatingButton } from '../../components/groups/CreateGroupFloatingButton';
import { FAB_LIST_GAP } from '../../components/GroupDetailFloatingActions';
import { resolveAutoTextInputStyle, rtlTextClassName, useRtlLayout } from '../../hooks/useRtlLayout';
import {
    BalanceState,
    DEFAULT_FILTERS,
    Filters,
    FiltersSheet,
    isAnyFilterActive,
} from '../../components/FiltersSheet';
import {
    isGroupArchived,
    passesGroupFilters,
    sortGroups,
} from '../../lib/groupListQuery';
import { AppIcon } from '../../components/AppIcon';
import { colors } from '../../theme';

function unique<T>(values: T[]): T[] {
    return Array.from(new Set(values));
}

function memberMatches(group: GroupWithMembers, q: string): string[] {
    if (!q) return [];
    const lower = q.toLowerCase();
    return (group.members ?? [])
        .filter(m => m.displayName.toLowerCase().includes(lower))
        .map(m => m.displayName);
}

export function GroupsListScreen() {
    const { t, i18n } = useTranslation();
    const isRtl = useRtlLayout();
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const listBottomPadding = createGroupFabScrollPadding() + FAB_LIST_GAP;
    const groupsQuery = useGroupsQuery();
    const groups = groupsQuery.data ?? [];
    // "Initial loading" = we have NO cached data yet AND a fetch is actively in
    // flight (not offline-paused). The gate (AuthenticatedAppGate) seeds the
    // groups cache before the navigator mounts, so in practice data is already
    // present and this is false. Keying on `data === undefined` (not
    // `groups.length === 0`) means a seeded EMPTY list shows the empty state
    // rather than a loading screen — and this screen never renders the
    // full-screen boot splash, which would leak the tab bar (it lives inside the
    // bottom-tab navigator).
    const isInitialLoading =
        groupsQuery.data === undefined && groupsQuery.fetchStatus === 'fetching';

    const { data: simplified } = useSimplifiedDebts();
    const balanceNetsByGroup = useMemo(() => {
        const out: Record<string, { net: number }> = {};
        simplified?.groupRollups.forEach((rollup, groupId) => {
            out[groupId] = { net: rollup.primary.net };
        });
        return out;
    }, [simplified]);
    // A group has any open debts iff `byGroupCurrency` has at least one
    // non-empty transfer list for it. Lets BalanceChip distinguish
    // "You are settled" (others still owe each other) from "Settled" (whole group clear).
    const groupHasOpenDebts = useMemo(() => {
        const out: Record<string, boolean> = {};
        simplified?.byGroupCurrency.forEach((byCurrency, groupId) => {
            for (const transfers of byCurrency.values()) {
                if (transfers.length > 0) {
                    out[groupId] = true;
                    break;
                }
            }
        });
        return out;
    }, [simplified]);

    const [refreshing, setRefreshing] = useState(false);
    const loadError = groupsQuery.isError;
    const { online } = useNetworkStatus();
    // Which empty-state to show when the list has no groups. Offline wins over a
    // generic load error so the user gets the honest "you're offline" message
    // instead of a bare "failed to load".
    const emptyVariant = resolveEmptyStateVariant({ online, hasError: loadError });
    const [searchQuery, setSearchQuery] = useState('');
    const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [archivedExpanded, setArchivedExpanded] = useState(false);

    const incomingBalanceState = route.params?.balanceState as BalanceState | undefined;
    const incomingShowArchived = route.params?.showArchived as boolean | undefined;
    useEffect(() => {
        if (incomingBalanceState === undefined && incomingShowArchived === undefined) return;
        if (incomingBalanceState !== undefined) {
            setFilters(f => ({ ...f, balanceState: incomingBalanceState }));
        }
        if (incomingShowArchived) {
            setArchivedExpanded(true);
        }
        navigation.setParams({ balanceState: undefined, showArchived: undefined });
    }, [incomingBalanceState, incomingShowArchived, navigation]);

    // Warm members + user profiles for every visible group so the
    // AddExpenseScreen's offline path works even for groups the user has
    // never tapped before. Without this, opening AddExpense offline on a
    // never-visited group shows an empty member picker and can't queue
    // an optimistic insert.
    const groupIdsKey = groups.map(g => g.id).join(',');
    useEffect(() => {
        for (const g of groups) {
            prefetchAddExpensePrerequisitesForGroup(g.id);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupIdsKey]);

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        await queryClient.invalidateQueries({ queryKey: queryKeys.groups });
        void queryClient.invalidateQueries({ queryKey: queryKeys.simplifiedDebts });
        void prefetchActivityFeed();
        setRefreshing(false);
    }, []);

    const handleGroupPress = useCallback(
        (groupId: string) => {
            prefetchGroupDetail(groupId);
            navigation.navigate('GroupDetail', { groupId });
        },
        [navigation],
    );
    const handleCreateGroup = useCallback(
        () => navigation.navigate('CreateGroup'),
        [navigation],
    );

    const availableCurrencies = useMemo(
        () => unique(groups.map(g => g.defaultCurrency)),
        [groups],
    );
    const trimmedQuery = searchQuery.trim();
    const sortLocale = i18n.language.startsWith('he') ? 'he' : undefined;

    const { activeRows, archivedRows } = useMemo(() => {
        const lowerQ = trimmedQuery.toLowerCase();
        const matched = groups
            .map(g => {
                const matchedNames = memberMatches(g, lowerQ);
                const nameHit =
                    !lowerQ || g.name.toLowerCase().includes(lowerQ);
                const searchHit = !lowerQ || nameHit || matchedNames.length > 0;
                return { group: g, matched: matchedNames, searchHit };
            })
            .filter(({ group, searchHit }) => {
                if (!searchHit) return false;
                const net = balanceNetsByGroup[group.id]?.net;
                return passesGroupFilters(group, filters, net);
            });

        const sortedGroups = sortGroups(
            matched.map(r => r.group),
            filters.sortBy,
            balanceNetsByGroup,
            sortLocale,
        );
        const order = new Map(sortedGroups.map((g, i) => [g.id, i]));
        const ordered = [...matched].sort(
            (a, b) => (order.get(a.group.id) ?? 0) - (order.get(b.group.id) ?? 0),
        );
        const active: typeof ordered = [];
        const archived: typeof ordered = [];
        for (const row of ordered) {
            (isGroupArchived(row.group) ? archived : active).push(row);
        }
        return { activeRows: active, archivedRows: archived };
    }, [groups, trimmedQuery, filters, balanceNetsByGroup, sortLocale]);

    const filterActive = isAnyFilterActive(filters);

    type FilteredRow = (typeof activeRows)[number];

    // No balance dataset at all (e.g. offline before it was ever cached) →
    // tell each card its balance is unknown so it shows a neutral placeholder
    // instead of a false "Settled".
    const balanceUnknown = simplified === undefined;

    const renderGroupRow = useCallback(
        (item: FilteredRow) => (
            <GroupCard
                group={item.group}
                rollup={simplified?.groupRollups.get(item.group.id)}
                groupHasOpenDebts={groupHasOpenDebts[item.group.id] === true}
                balanceUnknown={balanceUnknown}
                searchQuery={trimmedQuery || undefined}
                matchedMemberNames={
                    item.matched.length > 0 ? item.matched : undefined
                }
                onPress={handleGroupPress}
            />
        ),
        [simplified, balanceUnknown, groupHasOpenDebts, trimmedQuery, handleGroupPress],
    );

    const renderItem = useCallback<ListRenderItem<FilteredRow>>(
        ({ item }) => renderGroupRow(item),
        [renderGroupRow],
    );

    const archivedFooter = useMemo(() => {
        if (archivedRows.length === 0) return null;
        return (
            <View>
                <TouchableOpacity
                    onPress={() => setArchivedExpanded(v => !v)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: archivedExpanded }}
                    testID="groups-archived-toggle"
                    className="mt-2 mb-3 py-3 flex-row items-center justify-center rounded-lg bg-slate-100"
                >
                    <Text className="text-sm font-medium text-gray-700 me-1">
                        {t('groups.archive.sectionLabel', { count: archivedRows.length })}
                    </Text>
                    <AppIcon
                        name={archivedExpanded ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color={colors.gray500}
                    />
                </TouchableOpacity>
                {archivedExpanded
                    ? archivedRows.map(row => (
                          <View key={row.group.id}>{renderGroupRow(row)}</View>
                      ))
                    : null}
            </View>
        );
    }, [archivedRows, archivedExpanded, renderGroupRow, t]);

    if (isInitialLoading) {
        // Render nothing — never the full-screen boot splash. The gate owns that
        // splash (full-screen, above the tabs); showing it here would put the icon
        // behind the bottom bar. With the gate seeding the cache this is reached
        // only in rare degraded-network edges, where blank-until-data beats both a
        // tab-bar-leaking splash and a premature empty-state flash.
        return null;
    }

    return (
        <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
            <View className="flex-row items-center px-4 py-2">
                <View className="flex-1 flex-row items-center rounded-full bg-gray-100 px-3 h-9">
                    <AppIcon name="search" size={18} color={colors.gray500} />
                    <TextInput
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder={t('groups.search.placeholder')}
                        placeholderTextColor={colors.gray400}
                        className={[
                            'flex-1 text-sm text-gray-900 mx-2',
                            rtlTextClassName(isRtl),
                        ]
                            .filter(Boolean)
                            .join(' ')}
                        autoCorrect={false}
                        autoCapitalize="none"
                        returnKeyType="search"
                        style={resolveAutoTextInputStyle(isRtl)}
                        testID="groups-search-input"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity
                            onPress={() => setSearchQuery('')}
                            accessibilityRole="button"
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <AppIcon
                                name="close-circle"
                                size={18}
                                color={colors.gray400}
                            />
                        </TouchableOpacity>
                    )}
                </View>
                <TouchableOpacity
                    onPress={() => setFiltersOpen(true)}
                    accessibilityRole="button"
                    accessibilityLabel={t('groups.filters.title')}
                    className="ml-2 h-9 w-9 items-center justify-center relative"
                    testID="groups-filter-btn"
                >
                    <AppIcon
                        name="options-outline"
                        size={22}
                        color={colors.gray500}
                    />
                    {filterActive && (
                        <View className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
                    )}
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={handleCreateGroup}
                    accessibilityRole="button"
                    accessibilityLabel={t('groups.createGroup')}
                    className="ml-1 h-9 w-9 items-center justify-center rounded-full bg-primary"
                    testID="groups-create-btn"
                >
                    <AppIcon name="add" size={22} color={colors.white} />
                </TouchableOpacity>
            </View>

            <View className="flex-1">
                <FlatList
                    data={activeRows}
                    keyExtractor={item => item.group.id}
                    renderItem={renderItem}
                    initialNumToRender={12}
                    maxToRenderPerBatch={8}
                    windowSize={7}
                    removeClippedSubviews
                    className="flex-1"
                    contentContainerStyle={{
                        paddingHorizontal: 16,
                        paddingBottom: listBottomPadding,
                    }}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            tintColor={colors.primary}
                        />
                    }
                    ListFooterComponent={archivedFooter}
                    ListEmptyComponent={
                        // Archived groups exist (just no active ones) → the
                        // archived footer renders them; no empty state needed.
                        archivedRows.length > 0 ? null : emptyVariant === 'offline' ? (
                            <EmptyState
                                iconName="cloud-offline-outline"
                                title={t('common.offlineTitle')}
                                message={t('groups.offlineMessage')}
                            />
                        ) : emptyVariant === 'error' ? (
                            <EmptyState
                                iconName="alert-circle-outline"
                                title={t('groups.loadError')}
                                message={t('common.networkError')}
                                actionTitle={t('common.retry')}
                                onAction={handleRefresh}
                            />
                        ) : (
                            <EmptyState
                                iconName="people-outline"
                                title={t('groups.noGroups')}
                                message={t('groups.noGroupsMessage')}
                                actionTitle={t('groups.createGroup')}
                                onAction={handleCreateGroup}
                            />
                        )
                    }
                />

            </View>

            <CreateGroupFabAnchor>
                <CreateGroupFloatingButton
                    title={t('groups.createGroup')}
                    onPress={handleCreateGroup}
                    icon="add"
                    testID="groups-bottom-cta"
                />
            </CreateGroupFabAnchor>

            <FiltersSheet
                visible={filtersOpen}
                filters={filters}
                availableCurrencies={availableCurrencies}
                onChange={setFilters}
                onClose={() => setFiltersOpen(false)}
            />
        </SafeAreaView>
    );
}
