import React from 'react';
import { View, Switch } from 'react-native';
import { Text } from '../AppText';
import { AppIcon, AppIconName } from '../AppIcon';
import { colors } from '../../theme';

interface Props {
    iconName: AppIconName;
    label: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
    disabled?: boolean;
    testID?: string;
}

export function SettingsToggleRow({ iconName, label, value, onValueChange, disabled, testID }: Props) {
    return (
        <View
            className="flex-row items-center bg-white px-4 py-3.5 min-h-[52px]"
            style={disabled ? { opacity: 0.45 } : undefined}
        >
            <AppIcon name={iconName} size={22} color={colors.gray500} />
            <Text className="flex-1 ms-3 text-base text-gray-900">{label}</Text>
            <Switch
                value={value}
                onValueChange={onValueChange}
                disabled={disabled}
                testID={testID}
                trackColor={{ true: colors.primary, false: colors.gray300 }}
            />
        </View>
    );
}
