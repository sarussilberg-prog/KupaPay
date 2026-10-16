import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '../components/AppText';
import { useRtlLayout } from '../hooks/useRtlLayout';

type Props = {
    headline: string;
    subline?: string;
    children: React.ReactNode;
    width: number;
    height: number;
};

export function AscStoreListingFrame({ headline, subline, children, width, height }: Props) {
    const isRtl = useRtlLayout();
    const phoneWidth = Math.round(width * 0.78);
    const phoneHeight = Math.round(height * 0.62);

    return (
        <View style={[styles.root, { width, height }]} testID="asc-capture-frame">
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
                            width: phoneWidth,
                            height: phoneHeight,
                        },
                    ]}
                    testID="asc-capture-phone"
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
        paddingTop: Platform.OS === 'web' ? 72 : 48,
        paddingHorizontal: 40,
        alignItems: 'flex-start',
    },
    contentRtl: {
        alignItems: 'flex-end',
    },
    headline: {
        color: '#ffffff',
        fontSize: 52,
        fontWeight: '800',
        maxWidth: '92%',
        lineHeight: 58,
        letterSpacing: -0.5,
    },
    subline: {
        marginTop: 12,
        color: 'rgba(255,255,255,0.92)',
        fontSize: 28,
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
        marginTop: 36,
        alignSelf: 'center',
        borderRadius: 36,
        backgroundColor: '#0f172a',
        padding: 10,
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
