/**
 * GroupsListHeader — mockup B2 title row with search, filter, and create actions.
 */

import React, { useMemo } from 'react';
import { View, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../AppText';
import { SearchExpandable } from '../SearchExpandable';
import { RoundIconButton } from '../primitives/RoundIconButton';
import { AppIcon } from '../AppIcon';
import { colors } from '../../theme';
import { useRtlLayout, rtlRowStyle } from '../../hooks/useRtlLayout';
import { resolveGroupsListCreatePillMaxWidth } from '../groupsListLayout';

interface GroupsListHeaderProps {
    searchQuery: string;
    onSearchQueryChange: (value: string) => void;
    searchExpanded: boolean;
    onSearchExpandedChange: (expanded: boolean) => void;
    filterActive: boolean;
    onOpenFilters: () => void;
    onCreateGroup: () => void;
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
    const { width: windowWidth } = useWindowDimensions();
    const createPillMaxWidth = useMemo(
        () => resolveGroupsListCreatePillMaxWidth(windowWidth),
        [windowWidth],
    );

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

    return (
        <View className="px-4 pt-2 pb-3 gap-3">
            <View style={rtlRowStyle(isRtl)} className="items-center gap-2">
                <Text
                    className="flex-1 shrink text-2xl font-bold text-gray-900 dark:text-gray-50"
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.72}
                    testID="groups-list-title"
                    style={{ minWidth: 0, flexShrink: 1 }}
                >
                    {t('groups.listTitle')}
                </Text>
                <View
                    style={rtlRowStyle(isRtl)}
                    className="items-center gap-2 shrink-0"
                    testID="groups-list-header-actions"
                >
                    <RoundIconButton
                        iconName="search"
                        onPress={() => onSearchExpandedChange(true)}
                        accessibilityLabel={t('common.search')}
                        testID="groups-search-btn"
                    />
                    <RoundIconButton
                        iconName="options-outline"
                        onPress={onOpenFilters}
                        accessibilityLabel={t('groups.filters.title')}
                        testID="groups-filter-btn"
                        badge={filterActive}
                    />
                    <TouchableOpacity
                        onPress={onCreateGroup}
                        accessibilityRole="button"
                        accessibilityLabel={t('groups.createGroup')}
                        testID="groups-create-btn"
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={[rtlRowStyle(isRtl), { maxWidth: createPillMaxWidth, minWidth: 0 }]}
                        className="h-10 items-center justify-center gap-1 rounded-full bg-primary px-3 shrink"
                    >
                        <AppIcon name="add" size={18} color={colors.white} />
                        <Text
                            className="text-xs font-semibold text-white shrink"
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.8}
                            style={{ flexShrink: 1, minWidth: 0 }}
                        >
                            {t('groups.createGroup')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}
