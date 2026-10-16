import React from 'react';
import { type AppIconName } from '../AppIcon';
import { IconLabel } from './IconLabel';
import { ListRow } from './ListRow';

type Props = {
    iconName: AppIconName;
    iconColor: string;
    label: string;
    labelClassName?: string;
    onPress: () => void;
    testID?: string;
    disabled?: boolean;
    className?: string;
};

/** Compact icon + label row for action sheets and overflow menus. */
export function MenuRow({
    iconName,
    iconColor,
    label,
    labelClassName = 'text-sm font-medium text-gray-900',
    onPress,
    testID,
    disabled,
    className = 'px-3 py-2.5 rounded-lg min-h-0 bg-transparent',
}: Props) {
    return (
        <ListRow className={className} onPress={onPress} testID={testID} disabled={disabled}>
            <IconLabel
                density="compact"
                iconName={iconName}
                iconColor={iconColor}
                label={label}
                labelClassName={labelClassName}
            />
        </ListRow>
    );
}
