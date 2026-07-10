/**
 * FavoriteGroupSwitcher — the small "switch group" button shown at the top of
 * the Favorite Group tab. Shows the active group's name; tapping opens the
 * GroupPickerSheet, and choosing a group persists it via setFavoriteGroupId.
 */
import React, { useCallback, useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GroupWithMembers } from '@cost-share/shared';
import { Text } from '../AppText';
import { AppIcon } from '../AppIcon';
import { colors } from '../../theme';
import { useRtlLayout, rtlRowStyle } from '../../hooks/useRtlLayout';
import { useAppStore } from '../../store';
import { GroupPickerSheet } from './GroupPickerSheet';

interface Props {
    /** The effective (resolved) group id currently shown in the tab. */
    groupId: string;
    /** Display name of the effective group. */
    groupName: string;
    /** All member groups, for the picker list. */
    groups: GroupWithMembers[];
}

export function FavoriteGroupSwitcher({ groupId, groupName, groups }: Props) {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();
    const setFavoriteGroupId = useAppStore((s) => s.setFavoriteGroupId);
    const [pickerOpen, setPickerOpen] = useState(false);

    const handleSelect = useCallback(
        (id: string) => {
            setFavoriteGroupId(id);
            setPickerOpen(false);
        },
        [setFavoriteGroupId],
    );

    return (
        <View className="px-4 pt-2 pb-1">
            <TouchableOpacity
                onPress={() => setPickerOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={t('favoriteGroup.switchLabel')}
                testID="favorite-switch-btn"
                style={rtlRowStyle(isRtl)}
                className="self-start items-center rounded-full bg-gray-100 px-3 h-9"
            >
                <AppIcon name="star" size={16} color={colors.primary} />
                <Text
                    testID="favorite-switch-label"
                    className="text-sm font-semibold text-gray-900 mx-2"
                    numberOfLines={1}
                >
                    {groupName}
                </Text>
                <AppIcon name="swap-horizontal" size={16} color={colors.gray500} />
            </TouchableOpacity>

            <GroupPickerSheet
                visible={pickerOpen}
                groups={groups}
                selectedGroupId={groupId}
                onSelectGroup={handleSelect}
                onClose={() => setPickerOpen(false)}
            />
        </View>
    );
}
