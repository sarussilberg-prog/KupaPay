import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '../AppText';
import { AppIcon } from '../AppIcon';
import { colors } from '../../theme';
import { rtlRowStyle, useRtlLayout } from '../../hooks/useRtlLayout';

type Props = {
    icon?: React.ComponentProps<typeof AppIcon>['name'];
    emoji?: string;
    label: string;
    tone?: 'muted' | 'default';
    numberOfLines?: number;
    style?: StyleProp<ViewStyle>;
    testID?: string;
};

export function IconLabel({
    icon,
    emoji,
    label,
    tone = 'muted',
    numberOfLines = 1,
    style,
    testID,
}: Props) {
    const isRtl = useRtlLayout();
    const textClass =
        tone === 'muted' ? 'text-xs text-gray-500' : 'text-xs text-gray-700';

    return (
        <View
            testID={testID}
            style={[rtlRowStyle(isRtl), { alignItems: 'center', gap: 4, minWidth: 0 }, style]}
        >
            {emoji ? (
                <Text style={{ fontSize: 12 }} accessibilityElementsHidden>
                    {emoji}
                </Text>
            ) : icon ? (
                <AppIcon name={icon} size={13} color={colors.gray400} />
            ) : null}
            <Text className={textClass} numberOfLines={numberOfLines} style={{ flexShrink: 1 }}>
                {label}
            </Text>
        </View>
    );
}
