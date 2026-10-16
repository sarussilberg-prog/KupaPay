import React from 'react';
import {
    View,
    TouchableOpacity,
    Platform,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import { rtlRowStyle, useRtlLayout } from '../../hooks/useRtlLayout';

type Props = {
    children: React.ReactNode;
    onPress?: () => void;
    testID?: string;
    style?: StyleProp<ViewStyle>;
    className?: string;
};

export function ListRow({ children, onPress, testID, style, className }: Props) {
    const isRtl = useRtlLayout();
    const rowStyle: ViewStyle = {
        alignItems: 'center',
        minWidth: 0,
        ...(Platform.OS !== 'web'
            ? { flexDirection: isRtl ? 'row-reverse' : 'row' }
            : rtlRowStyle(isRtl)),
    };

    if (onPress) {
        return (
            <TouchableOpacity
                onPress={onPress}
                activeOpacity={0.7}
                testID={testID}
                className={className}
                style={[rowStyle, style]}
            >
                {children}
            </TouchableOpacity>
        );
    }

    return (
        <View testID={testID} className={className} style={[rowStyle, style]}>
            {children}
        </View>
    );
}
