/**
 * ActivityItem Component
 * Activity feed item for expenses, settlements, and group messages
 */

import { Text } from './AppText';
import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { RecentActivity } from '@cost-share/shared';
import { AppIcon, AppIconName } from './AppIcon';
import { colors } from '../theme';
import { formatCurrencyAmount } from '../lib/currencyDisplay';

interface ActivityItemProps {
    activity: RecentActivity;
    onPress?: (activity: RecentActivity) => void;
}

function activityVisual(activity: RecentActivity): {
    iconName: AppIconName;
    iconColor: string;
    iconBg: string;
} {
    switch (activity.activityType) {
        case 'expense':
            return {
                iconName: 'cash-outline',
                iconColor: colors.primary,
                iconBg: 'bg-blue-50',
            };
        case 'settlement':
            return {
                iconName: 'swap-horizontal-outline',
                iconColor: colors.success,
                iconBg: 'bg-green-50',
            };
        case 'message':
            return {
                iconName: 'chatbubble-outline',
                iconColor: colors.gray600,
                iconBg: 'bg-gray-100',
            };
    }
}

export const ActivityItem = React.memo(function ActivityItem({
    activity,
    onPress,
}: ActivityItemProps) {
    const { t } = useTranslation();
    const isMessage = activity.activityType === 'message';
    const isExpense = activity.activityType === 'expense';
    const formattedDate = new Date(activity.activityDate).toLocaleDateString();
    const visual = activityVisual(activity);
    const pressable = Boolean(onPress);

    return (
        <TouchableOpacity
            onPress={() => onPress?.(activity)}
            activeOpacity={pressable ? 0.7 : 1}
            disabled={!pressable}
            className="bg-white rounded-xl p-4 mb-2 border border-gray-100"
        >
            <View className="flex-row items-center">
                <View
                    className={`w-10 h-10 rounded-lg justify-center items-center mr-3 ${visual.iconBg}`}
                >
                    <AppIcon
                        name={visual.iconName}
                        size={22}
                        color={visual.iconColor}
                        testID={`activity-icon-${activity.activityType}`}
                    />
                </View>

                <View className="flex-1 min-w-0">
                    <Text
                        className="text-base font-medium text-gray-900"
                        numberOfLines={isMessage ? 2 : 1}
                    >
                        {activity.description}
                    </Text>
                    <Text className="text-xs text-gray-400 mt-0.5">
                        {activity.userName}
                        {isMessage
                            ? ` • ${t('activity.message')}`
                            : ''}{' '}
                        • {formattedDate}
                    </Text>
                </View>

                {!isMessage && (
                    <Text
                        className={`text-base font-semibold ml-2 ${
                            isExpense ? 'text-gray-900' : 'text-green-600'
                        }`}
                    >
                        {formatCurrencyAmount(activity.amount, activity.currency)}
                    </Text>
                )}
            </View>
        </TouchableOpacity>
    );
});
