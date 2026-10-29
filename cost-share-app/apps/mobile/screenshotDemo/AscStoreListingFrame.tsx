import React from 'react';
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '../components/AppText';
import { useRtlLayout } from '../hooks/useRtlLayout';

type Props = {
    headline: string;
    subline?: string;
    children: React.ReactNode;
    phoneWidth: number;
    phoneHeight: number;
};

const BEZEL = 12;

/** Marketing frame: localized headline + device mockup at real logical phone size. */
export function AscStoreListingFrame({
    headline,
    subline,
    children,
    phoneWidth,
    phoneHeight,
}: Props) {
    const isRtl = useRtlLayout();
    const { width: canvasWidth, height: canvasHeight } = useWindowDimensions();
    const deviceWidth = phoneWidth + BEZEL * 2;
    const deviceHeight = phoneHeight + BEZEL * 2;

    return (
        <View
            style={[styles.root, { width: canvasWidth, height: canvasHeight }]}
            testID="asc-capture-frame"
        >
            <LinearGradient
                colors={['#1e3a8a', '#3b82f6', '#93c5fd']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />
            <View style={[styles.content, isRtl && styles.contentRtl]}>
                <Text
                    style={[
                        styles.headline,
                        isRtl ? styles.textRtl : styles.textLtr,
                        { alignSelf: 'stretch' },
                    ]}
                >
                    {headline}
                </Text>
                {subline ? (
                    <Text
                        style={[
                            styles.subline,
                            isRtl ? styles.textRtl : styles.textLtr,
                            { alignSelf: 'stretch' },
                        ]}
                    >
                        {subline}
                    </Text>
                ) : null}
                <View
                    style={[
                        styles.phone,
                        {
                            width: deviceWidth,
                            height: deviceHeight,
                            marginTop: Math.max(24, canvasHeight * 0.04),
                        },
                    ]}
                >
                    <View style={styles.phoneInner}>{children}</View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        overflow: 'hidden',
        backgroundColor: '#1e3a8a',
    },
    content: {
        flex: 1,
        paddingTop: Platform.OS === 'web' ? 56 : 40,
        paddingHorizontal: 36,
        alignItems: 'flex-start',
    },
    contentRtl: {
        alignItems: 'flex-end',
    },
    headline: {
        color: '#ffffff',
        fontSize: 46,
        fontWeight: '800',
        maxWidth: '92%',
        lineHeight: 52,
        letterSpacing: -0.5,
    },
    subline: {
        marginTop: 10,
        color: 'rgba(255,255,255,0.92)',
        fontSize: 24,
        fontWeight: '500',
        maxWidth: '88%',
    },
    textRtl: {
        textAlign: 'right',
        writingDirection: 'rtl',
    },
    textLtr: {
        textAlign: 'left',
    },
    phone: {
        alignSelf: 'center',
        borderRadius: 36,
        backgroundColor: '#0f172a',
        padding: BEZEL,
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 12 },
        ...(Platform.OS === 'web'
            ? { boxShadow: '0 24px 48px rgba(15,23,42,0.45)' }
            : {}),
    },
    phoneInner: {
        flex: 1,
        borderRadius: 28,
        overflow: 'hidden',
        backgroundColor: '#f8fafc',
    },
});
