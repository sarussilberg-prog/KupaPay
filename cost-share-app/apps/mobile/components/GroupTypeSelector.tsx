/**
 * GroupTypeSelector
 * Icon-based picker for group type (trip, home, couple, general)
 */

import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GroupType } from '@cost-share/shared';
import { Text } from './AppText';
import { AppIcon, AppIconName } from './AppIcon';
import { colors } from '../theme';

const GROUP_TYPE_OPTIONS: { key: GroupType; icon: AppIconName }[] = [
    { key: 'trip', icon: 'airplane-outline' },
    { key: 'home', icon: 'home-outline' },
    { key: 'couple', icon: 'heart-outline' },
    { key: 'general', icon: 'people-outline' },
];

interface GroupTypeSelectorProps {
    value: GroupType;
    onChange: (type: GroupType) => void;
}

export function GroupTypeSelector({ value, onChange }: GroupTypeSelectorProps) {
    const { t } = useTranslation();

    return (
        <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">
                {t('groups.groupType')}
            </Text>
            <View className="flex-row gap-2">
                {GROUP_TYPE_OPTIONS.map((gt) => {
                    const selected = value === gt.key;
                    return (
                        <TouchableOpacity
                            key={gt.key}
                            onPress={() => onChange(gt.key)}
                            activeOpacity={0.7}
                            className={`flex-1 py-3 rounded-xl items-center ${
                                selected
                                    ? 'bg-primary-extra-light border border-primary'
                                    : 'bg-white border border-gray-200'
                            }`}
                        >
                            <View className="mb-1">
                                <AppIcon
                                    name={gt.icon}
                                    size={22}
                                    color={
                                        selected
                                            ? colors.primaryDark
                                            : colors.gray600
                                    }
                                />
                            </View>
                            <Text
                                className={`text-xs font-medium ${
                                    selected
                                        ? 'text-primary-dark'
                                        : 'text-gray-600'
                                }`}
                            >
                                {t(`groups.types.${gt.key}`)}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}
