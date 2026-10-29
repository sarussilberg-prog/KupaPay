import React, { useEffect } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';

const LIGHT_BAR = '#ffffff';
const DARK_BAR = '#111827';

/**
 * Keeps Android status + navigation bar button styles aligned with the system theme.
 * Background colors are best-effort (Android 15+ limits nav bar tinting).
 */
export function AndroidSystemChrome() {
    const scheme = useColorScheme();
    const isDark = scheme === 'dark';

    useEffect(() => {
        if (Platform.OS !== 'android') {
            return;
        }
        const barStyle = isDark ? 'light' : 'dark';
        void NavigationBar.setButtonStyleAsync(barStyle);
        void NavigationBar.setBackgroundColorAsync(isDark ? DARK_BAR : LIGHT_BAR);
    }, [isDark]);

    if (Platform.OS !== 'android') {
        return null;
    }

    return <StatusBar style={isDark ? 'light' : 'dark'} />;
}
