/**
 * GroupsListHeader — mockup B2 title row with search, filter, and create actions.
 */

import React, { useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useLayoutWindowWidth } from '../../hooks/useLayoutWindowWidth';
import { useTranslation } from 'react-i18next';
import { Text } from '../AppText';
import { SearchExpandable } from '../SearchExpandable';
import { RoundIconButton } from '../primitives/RoundIconButton';
import { AppIcon } from '../AppIcon';
import { colors } from '../../theme';
import { useRtlLayout, rtlRowStyle } from '../../hooks/useRtlLayout';
import {
    resolveGroupsListCreateShowsLabel,
    resolveGroupsListUsesStackedHeader,
} from '../groupsListLayout';

interface GroupsListHeaderProps {
    searchQuery: string;
    onSearchQueryChange: (value: string) => void;
    searchExpanded: boolean;
    onSearchExpandedChange: (expanded: boolean) => void;
    filterActive: boolean;
    onOpenFilters: () => void;
    onCreateGroup: () => void;
}

function HeaderActions({
    isRtl,
    filterActive,
    createShowsLabel,
    onSearchExpandedChange,
    onOpenFilters,
    onCreateGroup,
    createLabel,
    searchLabel,
    filterLabel,
}: {
    isRtl: boolean;
    filterActive: boolean;
    createShowsLabel: boolean;
    onSearchExpandedChange: (expanded: boolean) => void;
    onOpenFilters: () => void;
    onCreateGroup: () => void;
    createLabel: string;
    searchLabel: string;
    filterLabel: string;
}) {
    return (
        <View
            style={rtlRowStyle(isRtl)}
            className="items-center gap-2 shrink-0"
            testID="groups-list-header-actions"
        >
            <RoundIconButton
                iconName="search"
                onPress={() => onSearchExpandedChange(true)}
                accessibilityLabel={searchLabel}
                testID="groups-search-btn"
            />
            <RoundIconButton
                iconName="options-outline"
                onPress={onOpenFilters}
                accessibilityLabel={filterLabel}
                testID="groups-filter-btn"
                badge={filterActive}
            />
            {createShowsLabel ? (
                <TouchableOpacity
                    onPress={onCreateGroup}
                    accessibilityRole="button"
                    accessibilityLabel={createLabel}
                    testID="groups-create-btn"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={[styles.createPill, rtlRowStyle(isRtl)]}
                >
                    <AppIcon name="add" size={18} color={colors.white} />
                    <Text
                        testID="groups-create-btn-label"
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.75}
                        style={styles.createPillLabel}
                    >
                        {createLabel}
                    </Text>
                </TouchableOpacity>
            ) : (
                <TouchableOpacity
                    onPress={onCreateGroup}
                    accessibilityRole="button"
                    accessibilityLabel={createLabel}
                    testID="groups-create-btn"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    className="w-10 h-10 items-center justify-center rounded-full bg-primary"
                >
                    <AppIcon name="add" size={20} color={colors.white} />
                </TouchableOpacity>
            )}
        </View>
    );
}

export function GroupsListHeader({
    searchQuery,
    onSearchQueryChange,
    searchExpanded,
    onSearchExpandedChange,
    filterActive,
    onOpenFilters,
    onCreateGroup,
}: GroupsListHeaderProps) {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();
    const windowWidth = useLayoutWindowWidth();
    const stackedHeader = useMemo(
        () => resolveGroupsListUsesStackedHeader(windowWidth),
        [windowWidth],
    );
    const createShowsLabel = useMemo(
        () => resolveGroupsListCreateShowsLabel(windowWidth),
        [windowWidth],
    );
    const createLabel = t('groups.createGroup');

    if (searchExpanded) {
        return (
            <View className="px-4 pt-2 pb-3" style={rtlRowStyle(isRtl)}>
                <SearchExpandable
                    value={searchQuery}
                    onChangeText={onSearchQueryChange}
                    expanded={searchExpanded}
                    onExpandedChange={onSearchExpandedChange}
                    testID="groups-search"
                />
            </View>
        );
    }

    const titleNode = (
        <Text
            className="text-2xl font-bold text-gray-900 dark:text-gray-50"
            testID="groups-list-title"
            style={stackedHeader ? undefined : { flex: 1, minWidth: 0 }}
        >
            {t('groups.listTitle')}
        </Text>
    );

    const actionsNode = (
        <HeaderActions
            isRtl={isRtl}
            filterActive={filterActive}
            createShowsLabel={createShowsLabel}
            onSearchExpandedChange={onSearchExpandedChange}
            onOpenFilters={onOpenFilters}
            onCreateGroup={onCreateGroup}
            createLabel={createLabel}
            searchLabel={t('common.search')}
            filterLabel={t('groups.filters.title')}
        />
    );

    if (stackedHeader) {
        return (
            <View className="px-4 pt-2 pb-3 gap-3" testID="groups-list-header-stacked">
                {titleNode}
                <View style={rtlRowStyle(isRtl)} className="justify-end">
                    {actionsNode}
                </View>
            </View>
        );
    }

    return (
        <View className="px-4 pt-2 pb-3 gap-3" testID="groups-list-header-inline">
            <View style={rtlRowStyle(isRtl)} className="items-start gap-2">
                {titleNode}
                {actionsNode}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    createPill: {
        flexShrink: 0,
        minHeight: 40,
        maxWidth: '100%',
        paddingHorizontal: 12,
        paddingVertical: Platform.OS === 'android' ? 8 : 10,
        borderRadius: 9999,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    createPillLabel: {
        flexShrink: 1,
        fontSize: 12,
        fontWeight: '600',
        color: colors.white,
        lineHeight: 16,
        ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
    },
});
