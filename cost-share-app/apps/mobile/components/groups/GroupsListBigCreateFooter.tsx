/**
 * Scroll-with-list primary create CTA (locked groups-list spec).
 */

import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../AppText';
import { AppIcon } from '../AppIcon';
import { useRtlLayout, rtlRowStyle } from '../../hooks/useRtlLayout';
import { colors } from '../../theme';

interface GroupsListBigCreateFooterProps {
    onPress: () => void;
}

export function GroupsListBigCreateFooter({ onPress }: GroupsListBigCreateFooterProps) {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();

    return (
        <View className="mt-4 mb-2">
            <TouchableOpacity
                onPress={onPress}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={t('groups.bigCreateCta')}
                testID="groups-bottom-cta"
                className="h-14 rounded-2xl bg-primary items-center justify-center"
                style={rtlRowStyle(isRtl)}
            >
                <AppIcon name="add" size={22} color={colors.white} />
                <Text className="text-base font-semibold text-white ms-2">
                    {t('groups.bigCreateCta')}
                </Text>
            </TouchableOpacity>
        </View>
    );
}
