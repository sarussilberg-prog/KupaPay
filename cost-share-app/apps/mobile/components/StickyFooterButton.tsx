/**
 * StickyFooterButton — pinned full-width primary CTA above the bottom inset.
 */

import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIconName } from './AppIcon';
import { Button } from './Button';

interface StickyFooterButtonProps {
    title: string;
    onPress: () => void;
    icon?: AppIconName;
    testID?: string;
}

export function StickyFooterButton({
    title,
    onPress,
    icon,
    testID,
}: StickyFooterButtonProps) {
    const insets = useSafeAreaInsets();
    return (
        <View
            style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                paddingBottom: insets.bottom + 12,
                paddingTop: 10,
                paddingHorizontal: 16,
            }}
            className="bg-white border-t border-gray-100"
        >
            <Button
                title={title}
                onPress={onPress}
                variant="primary"
                icon={icon}
                className="h-14 rounded-2xl"
                testID={testID}
            />
        </View>
    );
}
