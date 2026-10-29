import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Text } from '../AppText';
const STATUS_HEIGHT = 54;

/** Marketing-capture status chrome (9:41, signal, battery) — web only. */
export function IosCaptureStatusBar() {
    if (Platform.OS !== 'web') return null;

    return (
        <View style={styles.bar} testID="ios-capture-status-bar">
            <Text style={styles.time}>9:41</Text>
            <View style={styles.icons}>
                <View style={styles.signalBars}>
                    {[6, 9, 12, 15].map(h => (
                        <View key={h} style={[styles.signalBar, { height: h }]} />
                    ))}
                </View>
                <View style={styles.wifiArc} />
                <View style={styles.battery}>
                    <View style={styles.batteryFill} />
                </View>
            </View>
        </View>
    );
}

export const IOS_CAPTURE_STATUS_BAR_HEIGHT = STATUS_HEIGHT;

const styles = StyleSheet.create({
    bar: {
        height: STATUS_HEIGHT,
        paddingHorizontal: 28,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#f8fafc',
    },
    time: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0f172a',
        letterSpacing: 0.2,
    },
    icons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    signalBars: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 2,
        height: 16,
    },
    signalBar: {
        width: 3,
        borderRadius: 1,
        backgroundColor: '#0f172a',
    },
    wifiArc: {
        width: 14,
        height: 14,
        borderWidth: 2,
        borderColor: '#0f172a',
        borderRadius: 8,
        borderBottomColor: 'transparent',
        borderLeftColor: 'transparent',
        transform: [{ rotate: '45deg' }],
    },
    battery: {
        width: 24,
        height: 12,
        borderWidth: 1.5,
        borderColor: '#0f172a',
        borderRadius: 3,
        padding: 1,
    },
    batteryFill: {
        flex: 1,
        backgroundColor: '#0f172a',
        borderRadius: 1,
    },
});
