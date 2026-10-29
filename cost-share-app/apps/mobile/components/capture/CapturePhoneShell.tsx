import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
    IosCaptureStatusBar,
    IOS_CAPTURE_STATUS_BAR_HEIGHT,
} from './IosCaptureStatusBar';

type Props = {
    width: number;
    height: number;
    children: React.ReactNode;
};

/**
 * Fixed logical phone viewport for store captures — real app navigator inside,
 * with iOS-style status bar chrome above the app safe area.
 */
export function CapturePhoneShell({ width, height, children }: Props) {
    const appHeight = height - IOS_CAPTURE_STATUS_BAR_HEIGHT;
    return (
        <View style={[styles.shell, { width, height }]} testID="asc-capture-phone">
            <IosCaptureStatusBar />
            <SafeAreaProvider
                initialMetrics={{
                    frame: { x: 0, y: IOS_CAPTURE_STATUS_BAR_HEIGHT, width, height: appHeight },
                    insets: { top: 0, left: 0, right: 0, bottom: 34 },
                }}
            >
                <View style={[styles.app, { height: appHeight }]}>{children}</View>
            </SafeAreaProvider>
        </View>
    );
}

const styles = StyleSheet.create({
    shell: {
        overflow: 'hidden',
        backgroundColor: '#f8fafc',
        borderRadius: 28,
    },
    app: {
        flex: 1,
        overflow: 'hidden',
        backgroundColor: '#f1f5f9',
    },
});
