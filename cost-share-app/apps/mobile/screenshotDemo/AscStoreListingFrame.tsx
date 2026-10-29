import React, { useMemo } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '../components/AppText';
import { useRtlLayout } from '../hooks/useRtlLayout';

/** Upper cap so the app region keeps most of the canvas (smallest iPhone logical heights). */
export const CAPTION_BAND_MAX_RATIO = 0.22;

const PADDING_TOP = 48;
const PADDING_BOTTOM = 28;
const HEADLINE_FONT = 32;
const HEADLINE_LINE_HEIGHT = 38;
const SUBLINE_FONT = 17;
const SUBLINE_LINE_HEIGHT = 22;
const SUBLINE_MARGIN_TOP = 8;

type Props = {
    headline: string;
    subline?: string;
    children: React.ReactNode;
};

function estimateHeadlineLines(headline: string, canvasWidth: number): number {
    const charsPerLine = Math.max(12, Math.floor((canvasWidth - 56) / (HEADLINE_FONT * 0.52)));
    const lines = Math.ceil(headline.length / charsPerLine);
    return Math.min(3, Math.max(1, lines));
}

/** Full-bleed listing: caption band on top, edge-to-edge app UI below (no device bezel). */
export function AscStoreListingFrame({ headline, subline, children }: Props) {
    const isRtl = useRtlLayout();
    const { width: canvasWidth, height: canvasHeight } = useWindowDimensions();

    const captionBandHeight = useMemo(() => {
        const headlineLines = estimateHeadlineLines(headline, canvasWidth);
        const headlineBlock = headlineLines * HEADLINE_LINE_HEIGHT;
        const sublineBlock = subline ? SUBLINE_MARGIN_TOP + SUBLINE_LINE_HEIGHT : 0;
        const contentHeight = PADDING_TOP + PADDING_BOTTOM + headlineBlock + sublineBlock;
        const maxBand = Math.round(canvasHeight * CAPTION_BAND_MAX_RATIO);
        return Math.min(maxBand, Math.max(contentHeight, Math.round(canvasHeight * 0.14)));
    }, [canvasWidth, canvasHeight, headline, subline]);

    return (
        <View
            style={[styles.root, { width: canvasWidth, height: canvasHeight }]}
            testID="asc-capture-frame"
        >
            <LinearGradient
                colors={['#1e3a8a', '#2563eb', '#60a5fa']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.captionBand, { height: captionBandHeight }]}
            >
                <View style={styles.captionInner}>
                    <Text
                        style={[
                            styles.headline,
                            isRtl ? styles.textRtl : styles.textLtr,
                        ]}
                    >
                        {headline}
                    </Text>
                    {subline ? (
                        <Text
                            style={[
                                styles.subline,
                                isRtl ? styles.textRtl : styles.textLtr,
                            ]}
                        >
                            {subline}
                        </Text>
                    ) : null}
                </View>
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
        flexShrink: 0,
    },
    captionInner: {
        flex: 1,
        paddingTop: PADDING_TOP,
        paddingBottom: PADDING_BOTTOM,
        paddingHorizontal: 28,
        justifyContent: 'flex-end',
    },
    headline: {
        color: '#ffffff',
        fontSize: HEADLINE_FONT,
        fontWeight: '800',
        lineHeight: HEADLINE_LINE_HEIGHT,
        letterSpacing: -0.4,
    },
    subline: {
        marginTop: SUBLINE_MARGIN_TOP,
        color: 'rgba(255,255,255,0.92)',
        fontSize: SUBLINE_FONT,
        fontWeight: '500',
        lineHeight: SUBLINE_LINE_HEIGHT,
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
