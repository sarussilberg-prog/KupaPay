import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { listRowContainerStyle, ICON_LABEL_GAP } from './iconLabelLayout';
import { AppPressable } from '../AppPressable';

type ListRowProps = {
    children: React.ReactNode;
    onPress?: () => void;
    disabled?: boolean;
    testID?: string;
    className?: string;
    gap?: number;
    style?: StyleProp<ViewStyle>;
};

/**
 * Shared horizontal list / settings row shell (icon label + trailing affordances).
 */
export function ListRow({
    children,
    onPress,
    disabled,
    testID,
    className = 'bg-white px-4 py-3.5 min-h-[52px]',
    gap = ICON_LABEL_GAP,
    style,
}: ListRowProps) {
    const isRtl = useRtlLayout();
    const containerStyle = [listRowContainerStyle(isRtl, gap), disabled ? { opacity: 0.45 } : undefined, style];

    const inner = (
        <View className={className} style={containerStyle} testID={testID}>
            {children}
        </View>
    );

    if (onPress) {
        return (
            <AppPressable
                onPress={onPress}
                disabled={disabled}
                testID={testID ? `${testID}-press` : undefined}
            >
                {inner}
            </AppPressable>
        );
    }

    return inner;
}
