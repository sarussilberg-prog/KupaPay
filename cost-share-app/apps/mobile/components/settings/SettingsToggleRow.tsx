import React from 'react';
import { Switch } from 'react-native';
import { AppIconName } from '../AppIcon';
import { colors } from '../../theme';
import { IconLabel } from '../ui/IconLabel';
import { ListRow } from '../ui/ListRow';

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
        <ListRow testID={testID} disabled={disabled}>
            <IconLabel iconName={iconName} iconColor={colors.gray500} label={label} />
            <Switch
                value={value}
                onValueChange={onValueChange}
                disabled={disabled}
                testID={testID ? `${testID}-switch` : undefined}
                trackColor={{ true: colors.primary, false: colors.gray300 }}
            />
        </ListRow>
    );
}
