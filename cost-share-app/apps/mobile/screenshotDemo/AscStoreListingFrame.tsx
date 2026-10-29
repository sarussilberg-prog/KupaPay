import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '../components/AppText';
import { useRtlLayout } from '../hooks/useRtlLayout';

/** Caption band may use at most this share of the listing canvas height. */
export const CAPTION_BAND_MAX_RATIO = 0.18;

type Props = {
    headline: string;
    subline?: string;
    children: React.ReactNode;
};

/** Full-bleed listing: caption band on top, edge-to-edge app UI below (no device bezel). */
export function AscStoreListingFrame({ headline, subline, children }: Props) {
    const isRtl = useRtlLayout();
    const { width: canvasWidth, height: canvasHeight } = useWindowDimensions();
    const captionMaxHeight = Math.round(canvasHeight * CAPTION_BAND_MAX_RATIO);

    return (
        <View
            style={[styles.root, { width: canvasWidth, height: canvasHeight }]}
            testID="asc-capture-frame"
        >
            <LinearGradient
                colors={['#1e3a8a', '#2563eb', '#60a5fa']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.captionBand, { maxHeight: captionMaxHeight }]}
            >
                <Text
                    style={[
                        styles.headline,
                        isRtl ? styles.textRtl : styles.textLtr,
                    ]}
                    numberOfLines={3}
                >
                    {headline}
                </Text>
                {subline ? (
                    <Text
                        style={[
                            styles.subline,
                            isRtl ? styles.textRtl : styles.textLtr,
                        ]}
                        numberOfLines={1}
                    >
                        {subline}
                    </Text>
                ) : null}
            </LinearGradient>
            <View style={styles.appRegion}>{children}</View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        overflow: 'hidden',
        backgroundColor: '#f1f5f9',
        flexDirection: 'column',
    },
    captionBand: {
        width: '100%',
        paddingTop: 52,
        paddingBottom: 20,
        paddingHorizontal: 28,
        justifyContent: 'flex-end',
    },
    headline: {
        color: '#ffffff',
        fontSize: 34,
        fontWeight: '800',
        lineHeight: 40,
        letterSpacing: -0.4,
    },
    subline: {
        marginTop: 8,
        color: 'rgba(255,255,255,0.92)',
        fontSize: 18,
        fontWeight: '500',
    },
    textRtl: {
        textAlign: 'right',
        writingDirection: 'rtl',
    },
    textLtr: {
        textAlign: 'left',
    },
    appRegion: {
        flex: 1,
        width: '100%',
        minHeight: 0,
        backgroundColor: '#f1f5f9',
    },
});
