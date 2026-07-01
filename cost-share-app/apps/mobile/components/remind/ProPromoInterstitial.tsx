/**
 * ProPromoInterstitial — a house "Go Pro" ad shown in place of a rewarded ad
 * approximately every 4th gate open. Mimics the Google interstitial format:
 *   - Full-screen overlay
 *   - Thin progress bar sweeping left-to-right over the countdown
 *   - Countdown timer in the top-right corner that becomes an ✕ when done
 *   - Tapping ✕ (or the CTA after it appears) calls onDismiss to continue flow
 */

import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Image,
    Modal,
    Pressable,
    SafeAreaView,
    StyleSheet,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Text } from '../AppText';
import { AppIcon } from '../AppIcon';
import { colors } from '../../theme';
import { platformAlert } from '../../lib/platformAlert';

const APP_LOGO = require('../../assets/logo.png');

const COUNTDOWN_SECONDS = 5;

interface ProPromoInterstitialProps {
    visible: boolean;
    onDismiss: () => void;
}

export function ProPromoInterstitial({ visible, onDismiss }: ProPromoInterstitialProps) {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
    const [canDismiss, setCanDismiss] = useState(false);
    const progressAnim = useRef(new Animated.Value(0)).current;
    const animRef = useRef<Animated.CompositeAnimation | null>(null);

    useEffect(() => {
        if (!visible) {
            animRef.current?.stop();
            progressAnim.setValue(0);
            setSecondsLeft(COUNTDOWN_SECONDS);
            setCanDismiss(false);
            return;
        }

        // Animate the progress bar over the full countdown duration
        animRef.current = Animated.timing(progressAnim, {
            toValue: 1,
            duration: COUNTDOWN_SECONDS * 1000,
            useNativeDriver: false,
        });
        animRef.current.start();

        // Tick the integer countdown label
        const interval = setInterval(() => {
            setSecondsLeft(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    setCanDismiss(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            clearInterval(interval);
            animRef.current?.stop();
        };
    }, [visible]);

    const progressWidth = progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

    return (
        <Modal
            visible={visible}
            transparent={false}
            animationType="fade"
            statusBarTranslucent
            onRequestClose={canDismiss ? onDismiss : undefined}
        >
            <View style={[styles.root, { paddingTop: insets.top }]}>

                {/* ── Top chrome: progress bar + skip button ── */}
                <View style={styles.topChrome}>
                    <View style={styles.progressTrack}>
                        <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
                    </View>

                    <View style={styles.skipArea}>
                        <Text style={styles.adLabel}>{t('monetization.proPromo.adLabel')}</Text>
                        {canDismiss ? (
                            <Pressable
                                onPress={onDismiss}
                                style={styles.skipButton}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                testID="pro-promo-close-btn"
                            >
                                <AppIcon name="close" size={16} color="#fff" />
                            </Pressable>
                        ) : (
                            <View style={styles.skipButton}>
                                <Text style={styles.skipCountdown}>{secondsLeft}</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* ── Main ad content ── */}
                <View style={styles.content}>
                    {/* App logo + badge */}
                    <View style={styles.iconWrap}>
                        <Image source={APP_LOGO} style={styles.appLogo} resizeMode="contain" />
                        <View style={styles.proBadge}>
                            <Text style={styles.proBadgeText}>PRO</Text>
                        </View>
                    </View>

                    <Text style={styles.headline}>
                        {t('monetization.proPromo.headline')}
                    </Text>

                    <Text style={styles.body}>
                        {t('monetization.proPromo.body')}
                    </Text>

                    {/* Feature bullets */}
                    <View style={styles.featureList}>
                        {[
                            t('monetization.proPromo.feature1'),
                            t('monetization.proPromo.feature2'),
                            t('monetization.proPromo.feature3'),
                        ].map(f => (
                            <View key={f} style={styles.featureRow}>
                                <AppIcon
                                    name="checkmark-circle"
                                    size={20}
                                    color={colors.success.DEFAULT}
                                />
                                <Text style={styles.featureText}>{f}</Text>
                            </View>
                        ))}
                    </View>

                    {/* CTA — only visible once user can dismiss anyway */}
                    {canDismiss && (
                        <Pressable
                            style={styles.cta}
                            onPress={() =>
                                platformAlert(
                                    t('monetization.goProButton'),
                                    t('monetization.goProWorkingOnIt'),
                                    [{ text: t('common.ok'), onPress: onDismiss }],
                                )
                            }
                            testID="pro-promo-cta-btn"
                        >
                            <Text style={styles.ctaText}>
                                {t('monetization.proPromo.cta')}
                            </Text>
                        </Pressable>
                    )}

                    <Pressable onPress={canDismiss ? onDismiss : undefined} style={styles.skipLink}>
                        <Text style={[styles.skipLinkText, !canDismiss && { opacity: 0 }]}>
                            {t('monetization.proPromo.skipLink')}
                        </Text>
                    </Pressable>
                </View>

                {/* ── Bottom safe-area pad ── */}
                <View style={{ height: Math.max(insets.bottom, 16) }} />
            </View>
        </Modal>
    );
}

const BRAND_BLUE = '#1D4ED8';

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#0F172A',
    },
    topChrome: {
        gap: 0,
    },
    progressTrack: {
        height: 3,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    progressFill: {
        height: 3,
        backgroundColor: '#60A5FA',
    },
    skipArea: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    adLabel: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.5)',
        fontWeight: '500',
        letterSpacing: 0.3,
    },
    skipButton: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    skipCountdown: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
        textAlign: 'center',
        writingDirection: 'ltr',
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        gap: 0,
    },
    iconWrap: {
        position: 'relative',
        marginBottom: 24,
    },
    appLogo: {
        width: 88,
        height: 88,
        borderRadius: 20,
    },
    proBadge: {
        position: 'absolute',
        bottom: -8,
        right: -10,
        backgroundColor: BRAND_BLUE,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderWidth: 2,
        borderColor: '#0F172A',
    },
    proBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1,
    },
    headline: {
        fontSize: 26,
        fontWeight: '700',
        color: '#F1F5F9',
        textAlign: 'center',
        lineHeight: 33,
        marginBottom: 14,
    },
    body: {
        fontSize: 15,
        color: '#94A3B8',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 28,
    },
    featureList: {
        width: '100%',
        gap: 12,
        marginBottom: 32,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    featureText: {
        fontSize: 15,
        color: '#E2E8F0',
        fontWeight: '500',
    },
    cta: {
        backgroundColor: BRAND_BLUE,
        borderRadius: 16,
        paddingVertical: 16,
        paddingHorizontal: 40,
        alignItems: 'center',
        width: '100%',
        marginBottom: 16,
    },
    ctaText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
        textAlign: 'center',
        writingDirection: 'ltr',
    },
    skipLink: {
        paddingVertical: 8,
    },
    skipLinkText: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.4)',
        textDecorationLine: 'underline',
    },
});
