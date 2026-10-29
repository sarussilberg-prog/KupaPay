import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
    IosCaptureStatusBar,
    IOS_CAPTURE_STATUS_BAR_HEIGHT,
} from './IosCaptureStatusBar';

type Props = Readonly<{
    children: React.ReactNode;
    /** When true, fill the parent app region (full-bleed listing). */
    fullBleed?: boolean;
}>;

/**
 * App viewport for store captures — iOS status chrome + navigator, edge-to-edge width.
 */
export function CapturePhoneShell({ children, fullBleed = true }: Props) {
    return (
        <View
            style={[styles.shell, fullBleed && styles.fullBleed]}
            testID="asc-capture-phone"
        >
            <IosCaptureStatusBar />
            <SafeAreaProvider
                initialMetrics={{
                    frame: {
                        x: 0,
                        y: IOS_CAPTURE_STATUS_BAR_HEIGHT,
                        width: 430,
                        height: 800,
                    },
                    insets: { top: 0, left: 0, right: 0, bottom: 34 },
                }}
            >
                <View style={styles.app}>{children}</View>
            </SafeAreaProvider>
        </View>
    );
}

const styles = StyleSheet.create({
    shell: {
        flex: 1,
        width: '100%',
        overflow: 'hidden',
        backgroundColor: '#f8fafc',
    },
    fullBleed: {
        borderRadius: 0,
    },
    app: {
        flex: 1,
        overflow: 'hidden',
        backgroundColor: '#f1f5f9',
    },
});
