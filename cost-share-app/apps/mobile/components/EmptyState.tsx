/**
 * EmptyState Component
 * Reusable empty state with icon, title, message, and optional action
 * Uses NativeWind styling only
 */

import { Text } from './AppText';
import React from 'react';
import { View } from 'react-native';
import { AppIcon, AppIconName } from './AppIcon';
import { Button } from './Button';
import { colors } from '../theme';

interface EmptyStateProps {
    iconName?: AppIconName;
    /** Large emoji illustration above the title (#394). */
    illustrationEmoji?: string;
    title: string;
    message?: string;
    actionTitle?: string;
    onAction?: () => void;
    secondaryActionTitle?: string;
    onSecondaryAction?: () => void;
}

export function EmptyState({
    iconName,
    illustrationEmoji,
    title,
    message,
    actionTitle,
    onAction,
    secondaryActionTitle,
    onSecondaryAction,
}: EmptyStateProps) {
    return (
        <View className="flex-1 justify-center items-center px-8 py-12">
            {illustrationEmoji ? (
                <Text className="text-5xl mb-3" accessibilityElementsHidden>
                    {illustrationEmoji}
                </Text>
            ) : null}
            {iconName && (
                <View className="mb-4">
                    <AppIcon
                        name={iconName}
                        size={56}
                        color={colors.gray300}
                        testID="empty-state-icon"
                    />
                </View>
            )}
            <Text className="text-xl font-semibold text-gray-800 text-center mb-2">
                {title}
            </Text>
            {message && (
                <Text className="text-base text-gray-500 text-center mb-6">
                    {message}
                </Text>
            )}
            {actionTitle && onAction && (
                <Button
                    title={actionTitle}
                    onPress={onAction}
                    fullWidth={false}
                />
            )}
            {secondaryActionTitle && onSecondaryAction && (
                <View className="mt-3">
                    <Button
                        title={secondaryActionTitle}
                        onPress={onSecondaryAction}
                        variant="outline"
                        fullWidth={false}
                    />
                </View>
            )}
        </View>
    );
}
