/**
 * GroupsListHeader — mockup B2 title row with search, filter, and create actions.
 */

import React from 'react';
import { View, TouchableOpacity, useWindowDimensions } from 'react-native';
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
    const { width } = useWindowDimensions();
    const compactCreateCta = width < 380;

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
                    numberOfLines={2}
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
                        className={
                            compactCreateCta
                                ? 'h-10 w-10 items-center justify-center rounded-full bg-primary'
                                : 'h-10 px-3 flex-row items-center justify-center rounded-full bg-primary gap-1 max-w-[148px]'
                        }
                    >
                        <AppIcon name="add" size={20} color={colors.white} />
                        {!compactCreateCta ? (
                            <Text
                                className="text-sm font-semibold text-white shrink"
                                numberOfLines={1}
                            >
                                {t('groups.newGroupCta')}
                            </Text>
                        ) : null}
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}
