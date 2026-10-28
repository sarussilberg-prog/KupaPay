/**
 * Floating create-group pill (design handoff groups list).
 */

import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../AppText';
import { AppIcon } from '../AppIcon';
import { useRtlLayout, rtlRowStyle } from '../../hooks/useRtlLayout';
import { colors, shadows } from '../../theme';

interface GroupsListCreateFabProps {
    onPress: () => void;
    bottomInset?: number;
}

export function GroupsListCreateFab({ onPress, bottomInset = 76 }: GroupsListCreateFabProps) {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();

    return (
        <View
            pointerEvents="box-none"
            className="absolute left-0 right-0 items-end px-4"
            style={{ bottom: bottomInset, zIndex: 10 }}
        >
            <TouchableOpacity
                onPress={onPress}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel={t('groups.createGroup')}
                testID="groups-create-fab"
                className="rounded-full bg-primary px-[18px] py-3"
                style={[rtlRowStyle(isRtl), shadows.md]}
            >
                <AppIcon name="add" size={22} color={colors.white} />
                <Text className="text-[15px] font-semibold text-white ms-1.5">
                    {t('groups.createGroup')}
                </Text>
            </TouchableOpacity>
        </View>
    );
}
