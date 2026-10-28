/**
 * Wordmark header row for handoff-style groups list.
 */

import React from 'react';
import { View } from 'react-native';
import { AppBrandTitle } from '../AppBrandTitle';
import { RoundIconButton } from '../primitives/RoundIconButton';
import { useTranslation } from 'react-i18next';
import { useRtlLayout, rtlRowStyle } from '../../hooks/useRtlLayout';

interface GroupsListHandoffHeaderProps {
    onFocusSearch: () => void;
}

export function GroupsListHandoffHeader({ onFocusSearch }: GroupsListHandoffHeaderProps) {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();

    return (
        <View
            className="bg-white dark:bg-gray-900 px-4 pt-2 pb-1 items-center justify-between"
            style={rtlRowStyle(isRtl)}
        >
            <AppBrandTitle
                className="text-[26px] text-left flex-1"
                style={{ textAlign: isRtl ? 'right' : 'left' }}
                testID="groups-handoff-wordmark"
            />
            <RoundIconButton
                iconName="search"
                onPress={onFocusSearch}
                accessibilityLabel={t('common.search')}
                testID="groups-handoff-search-focus"
            />
        </View>
    );
}
