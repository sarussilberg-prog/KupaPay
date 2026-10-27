/**
 * GroupsListHeader — mockup B2 title row with search, filter, and create actions.
 */

import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../AppText';
import { SearchExpandable } from '../SearchExpandable';
import { RoundIconButton } from '../primitives/RoundIconButton';
import { AppIcon } from '../AppIcon';
import { colors } from '../../theme';
import { useRtlLayout, rtlRowStyle } from '../../hooks/useRtlLayout';

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
                    testID="groups-list-title"
                    style={{ minWidth: 0 }}
                >
                    {t('groups.listTitle')}
                </Text>
                <View style={rtlRowStyle(isRtl)} className="items-center gap-2 shrink-0">
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
                        accessibilityLabel={t('groups.newGroupCta')}
                        testID="groups-create-btn"
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        className="h-10 w-10 items-center justify-center rounded-full bg-primary"
                    >
                        <AppIcon name="add" size={22} color={colors.white} />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}
