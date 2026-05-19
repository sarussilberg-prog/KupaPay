/**
 * AppIcon Component
 * Consistent Ionicons wrapper for navigation and UI affordances
 */

import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

export type AppIconName = keyof typeof Ionicons.glyphMap;

interface AppIconProps {
    name: AppIconName;
    size?: number;
    color?: string;
    testID?: string;
}

export function AppIcon({
    name,
    size = 24,
    color = colors.gray500,
    testID,
}: AppIconProps) {
    const icon = <Ionicons name={name} size={size} color={color} />;

    if (!testID) {
        return icon;
    }

    return <View testID={testID}>{icon}</View>;
}
