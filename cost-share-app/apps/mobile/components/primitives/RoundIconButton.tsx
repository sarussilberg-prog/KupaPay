/**
 * RoundIconButton — circular icon-only control (profile / list headers).
 */

import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { AppIcon, type AppIconName } from '../AppIcon';
import { colors, shadows } from '../../theme';

interface RoundIconButtonProps {
    iconName: AppIconName;
    onPress: () => void;
    accessibilityLabel: string;
    testID?: string;
    iconSize?: number;
    badge?: boolean;
}

export function RoundIconButton({
    iconName,
    onPress,
    accessibilityLabel,
    testID,
    iconSize = 20,
    badge = false,
}: RoundIconButtonProps) {
    return (
        <TouchableOpacity
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            testID={testID}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            className="w-10 h-10 items-center justify-center rounded-full bg-white border border-slate-200/80 relative"
            style={shadows.sm}
        >
            <AppIcon name={iconName} size={iconSize} color={colors.gray600} />
            {badge ? (
                <View
                    testID={testID ? `${testID}-badge` : undefined}
                    className="absolute top-1.5 end-1.5 w-2 h-2 rounded-full bg-primary"
                />
            ) : null}
        </TouchableOpacity>
    );
}
