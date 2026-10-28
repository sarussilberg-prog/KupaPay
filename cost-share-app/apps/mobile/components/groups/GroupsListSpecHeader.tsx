/**
 * Groups list header — locked spec (expandable search, filter, subtle create).
 */

import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SearchExpandable } from '../SearchExpandable';
import { RoundIconButton } from '../primitives/RoundIconButton';
import { useRtlLayout, rtlRowStyle } from '../../hooks/useRtlLayout';

interface GroupsListSpecHeaderProps {
    searchQuery: string;
    onSearchQueryChange: (value: string) => void;
    searchExpanded: boolean;
    onSearchExpandedChange: (expanded: boolean) => void;
    filterActive: boolean;
    onOpenFilters: () => void;
    onCreateGroup: () => void;
}

export function GroupsListSpecHeader({
    searchQuery,
    onSearchQueryChange,
    searchExpanded,
    onSearchExpandedChange,
    filterActive,
    onOpenFilters,
    onCreateGroup,
}: GroupsListSpecHeaderProps) {
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
        <View
            className="px-4 pt-2 pb-3 items-center justify-between"
            style={rtlRowStyle(isRtl)}
        >
            <View style={rtlRowStyle(isRtl)} className="items-center flex-1">
                <SearchExpandable
                    value={searchQuery}
                    onChangeText={onSearchQueryChange}
                    expanded={searchExpanded}
                    onExpandedChange={onSearchExpandedChange}
                    testID="groups-search"
                />
                <View className="w-2" />
                <RoundIconButton
                    iconName="options-outline"
                    onPress={onOpenFilters}
                    accessibilityLabel={t('groups.filters.title')}
                    testID="groups-filter-btn"
                    badge={filterActive}
                />
            </View>
            <RoundIconButton
                iconName="add"
                onPress={onCreateGroup}
                accessibilityLabel={t('groups.createGroup')}
                testID="groups-create-btn"
            />
        </View>
    );
}
