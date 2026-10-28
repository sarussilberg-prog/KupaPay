/**
 * Always-visible search row (design handoff groups list).
 */

import React, { RefObject } from 'react';
import { TextInput, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '../AppIcon';
import { RoundIconButton } from '../primitives/RoundIconButton';
import { resolveCompactTextInputStyle, rtlTextClassName, useRtlLayout, rtlRowStyle } from '../../hooks/useRtlLayout';
import { colors } from '../../theme';

interface GroupsListPersistentSearchBarProps {
    value: string;
    onChangeText: (value: string) => void;
    filterActive: boolean;
    onOpenFilters: () => void;
    inputRef?: RefObject<TextInput | null>;
}

export function GroupsListPersistentSearchBar({
    value,
    onChangeText,
    filterActive,
    onOpenFilters,
    inputRef,
}: GroupsListPersistentSearchBarProps) {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();

    return (
        <View
            className="mx-4 mb-3 flex-row items-center rounded-xl bg-gray-100 px-3 py-2.5 border-b border-slate-100"
            style={rtlRowStyle(isRtl)}
            testID="groups-handoff-search-row"
        >
            <AppIcon name="search" size={18} color={colors.gray400} />
            <TextInput
                ref={inputRef}
                value={value}
                onChangeText={onChangeText}
                placeholder={t('groups.search.placeholder')}
                placeholderTextColor={colors.gray400}
                className={['flex-1 text-sm text-gray-900 mx-2', rtlTextClassName(isRtl)].join(' ')}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                style={resolveCompactTextInputStyle(isRtl)}
                testID="groups-search-input"
            />
            <TouchableOpacity
                onPress={onOpenFilters}
                accessibilityRole="button"
                accessibilityLabel={t('groups.filters.title')}
                testID="groups-filter-btn"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
                <AppIcon
                    name="options-outline"
                    size={18}
                    color={filterActive ? colors.primaryDark : colors.gray400}
                />
            </TouchableOpacity>
        </View>
    );
}
