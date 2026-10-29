import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Text } from '../AppText';
import { useRtlLayout } from '../../hooks/useRtlLayout';

/** Logical height matching iOS status bar + inset (~47pt on 6.7"). */
export const IOS_CAPTURE_STATUS_BAR_HEIGHT = 47;

/** Marketing-capture status chrome (9:41, signal, Wi‑Fi, battery). */
export function IosCaptureStatusBar() {
    if (Platform.OS !== 'web') return null;

    const isRtl = useRtlLayout();
    // iOS keeps clock on the leading edge; in RTL UI the bar still reads time → trailing icons.
    const rowDirection = isRtl ? 'row-reverse' : 'row';

    return (
        <View style={[styles.bar, { flexDirection: rowDirection }]} testID="ios-capture-status-bar">
            <Text style={styles.time} allowFontScaling={false}>
                9:41
            </Text>
            <View style={[styles.icons, { flexDirection: rowDirection }]}>
                <View style={styles.cellular}>
                    {[4, 7, 10, 13].map(h => (
                        <View key={h} style={[styles.cellBar, { height: h }]} />
                    ))}
                </View>
                <View style={styles.wifi}>
                    <View style={styles.wifiDot} />
                    <View style={styles.wifiArcOuter} />
                    <View style={styles.wifiArcInner} />
                </View>
                <View style={styles.batteryWrap}>
                    <View style={styles.batteryBody}>
                        <View style={styles.batteryLevel} />
                    </View>
                    <View style={styles.batteryCap} />
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    bar: {
        height: IOS_CAPTURE_STATUS_BAR_HEIGHT,
        paddingHorizontal: 22,
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#f8fafc',
    },
    time: {
        fontSize: 15,
        fontWeight: '600',
        color: '#000000',
        letterSpacing: -0.3,
        fontVariant: ['tabular-nums'],
    },
    icons: {
        alignItems: 'center',
        gap: 5,
    },
    cellular: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 1.5,
        height: 13,
        marginEnd: 2,
    },
    cellBar: {
        width: 3,
        borderRadius: 0.5,
        backgroundColor: '#000000',
    },
    wifi: {
        width: 16,
        height: 12,
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginEnd: 2,
    },
    wifiDot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: '#000000',
        position: 'absolute',
        bottom: 0,
    },
    wifiArcOuter: {
        position: 'absolute',
        bottom: 1,
        width: 14,
        height: 7,
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
        borderWidth: 1.5,
        borderBottomWidth: 0,
        borderColor: '#000000',
    },
    wifiArcInner: {
        position: 'absolute',
        bottom: 3,
        width: 8,
        height: 4,
        borderTopLeftRadius: 5,
        borderTopRightRadius: 5,
        borderWidth: 1.5,
        borderBottomWidth: 0,
        borderColor: '#000000',
    },
    batteryWrap: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    batteryBody: {
        width: 25,
        height: 12,
        borderWidth: 1.2,
        borderColor: '#000000',
        borderRadius: 3,
        padding: 1.5,
    },
    batteryLevel: {
        flex: 1,
        backgroundColor: '#000000',
        borderRadius: 1,
    },
    batteryCap: {
        width: 1.5,
        height: 5,
        marginStart: 1,
        borderRadius: 0.5,
        backgroundColor: '#000000',
    },
});
