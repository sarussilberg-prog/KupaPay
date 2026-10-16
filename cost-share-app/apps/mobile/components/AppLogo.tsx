import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';
import { resolveInAppLogoSource } from '../lib/appIconVariant';

interface AppLogoProps {
    size?: number;
    style?: StyleProp<ImageStyle>;
    testID?: string;
}

/** KupaPay brand mark — use on auth and marketing surfaces. */
export function AppLogo({ size = 120, style, testID = 'app-logo' }: AppLogoProps) {
    return (
        <Image
            source={resolveInAppLogoSource()}
            style={[{ width: size, height: size }, style]}
            resizeMode="contain"
            accessibilityLabel="KupaPay"
            testID={testID}
        />
    );
}
