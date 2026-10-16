import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '../AppText';
import { AppIcon, type AppIconName } from '../AppIcon';
import { rtlTextClassName, useRtlLayout } from '../../hooks/useRtlLayout';
import {
    iconLabelMetrics,
    listRowContainerStyle,
    type IconLabelDensity,
} from './iconLabelLayout';

export type IconLabelProps = {
    iconName: AppIconName;
    iconSize?: number;
    iconColor: string;
    /** Plain label or custom text node. */
    label: React.ReactNode;
    labelClassName?: string;
    density?: IconLabelDensity;
    flex?: boolean;
    align?: 'center' | 'start';
    testID?: string;
    style?: StyleProp<ViewStyle>;
};

/**
 * Leading icon + text with a fixed icon box and theme gap — LTR/RTL safe.
 */
export function IconLabel({
    iconName,
    iconSize,
    iconColor,
    label,
    labelClassName = 'text-base text-gray-900',
    density = 'default',
    flex = true,
    align = 'center',
    testID,
    style,
}: IconLabelProps) {
    const isRtl = useRtlLayout();
    const { boxWidth, iconSize: defaultIconSize, gap } = iconLabelMetrics(density);
    const resolvedIconSize = iconSize ?? defaultIconSize;
    const rowAlign = align === 'start' ? 'flex-start' : 'center';

    const labelNode =
        typeof label === 'string' ? (
            <Text
                className={`${flex ? 'flex-1 min-w-0 ' : ''}${labelClassName} ${rtlTextClassName(isRtl, labelClassName)}`}
                testID={testID ? `${testID}-label` : undefined}
            >
                {label}
            </Text>
        ) : (
            label
        );

    return (
        <View
            style={[
                listRowContainerStyle(isRtl, gap, rowAlign),
                flex ? { flex: 1, minWidth: 0 } : undefined,
                style,
            ]}
            testID={testID}
        >
            <View style={{ width: boxWidth, alignItems: 'center', flexShrink: 0 }}>
                <AppIcon name={iconName} size={resolvedIconSize} color={iconColor} />
            </View>
            {labelNode}
        </View>
    );
}
