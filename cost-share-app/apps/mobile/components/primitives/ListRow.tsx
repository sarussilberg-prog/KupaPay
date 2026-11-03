import React from 'react';
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { listRowFlexStyle } from '../../lib/nativeRowLayoutStyle';
import { AppPressable } from '../AppPressable';

type Props = {
    children: React.ReactNode;
    onPress?: () => void;
    testID?: string;
    onLayout?: (event: LayoutChangeEvent) => void;
    style?: StyleProp<ViewStyle>;
    className?: string;
};

export function ListRow({ children, onPress, testID, onLayout, style, className }: Props) {
    const isRtl = useRtlLayout();
    const rowStyle: ViewStyle = {
        ...listRowFlexStyle(isRtl),
        alignItems: 'center',
    };

    if (onPress) {
        return (
            <AppPressable
                onPress={onPress}
                testID={testID}
                onLayout={onLayout}
                className={className}
                style={[rowStyle, style]}
            >
                {children}
            </AppPressable>
        );
    }

    return (
        <View testID={testID} onLayout={onLayout} className={className} style={[rowStyle, style]}>
            {children}
        </View>
    );
}
