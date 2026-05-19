import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { AppIcon, AppIconName } from '../AppIcon';
import { colors } from '../../theme';

interface Props {
    iconName: AppIconName;
    label: string;
    value: number;
    onPress: () => void;
    testID?: string;
}

export function StatTile({ iconName, label, value, onPress, testID }: Props) {
    return (
        <TouchableOpacity
            onPress={onPress}
            testID={testID}
            className="flex-1 bg-white rounded-2xl px-3 py-4 border border-gray-100 items-center"
            style={{ minHeight: 88 }}
        >
            <AppIcon name={iconName} size={24} color={colors.primary} />
            <Text className="text-xl font-bold text-gray-900 mt-2">{value}</Text>
            <Text className="text-xs text-gray-500 mt-0.5 text-center">{label}</Text>
        </TouchableOpacity>
    );
}
