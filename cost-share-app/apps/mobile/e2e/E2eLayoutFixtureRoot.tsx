import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import type { Language } from '@cost-share/shared';
import * as Linking from 'expo-linking';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { initializeLanguage } from '../i18n';
import { queryClient } from '../lib/queryClient';
import { RtlLayoutProvider } from '../hooks/useRtlLayout';
import { AppNavigator } from '../navigation/AppNavigator';
import { rootNavigationRef } from '../lib/rootNavigationRef';
import { navigateAscCaptureScreen } from '../lib/ascCaptureNavigate';
import { toastConfig } from '../lib/toastConfig';
import { useAppStore } from '../store';
import {
    parseE2eFixtureLocaleFromUrl,
    parseE2eFixtureNavigationFromUrl,
    parseE2eFixturePseudoLocaleFromUrl,
} from '../lib/e2eFixtureLocaleLink';
import type { AscCaptureScreen } from '../lib/ascCaptureParams';
import { applyE2eFixtureLocale, applyE2eFixturePseudoLocale } from './applyE2eFixtureLocale';
import { seedE2eLayoutFixtures } from './seedE2eLayoutFixtures';
import { ScreenErrorBoundary } from '../components/ScreenErrorBoundary';

function E2eFixtureNavigationController({
    onReady,
    navEpoch,
    captureScreen,
}: {
    onReady: () => void;
    navEpoch: number;
    captureScreen: AscCaptureScreen;
}) {
    useEffect(() => {
        let cancelled = false;
        let attempts = 0;

        const tick = () => {
            if (cancelled) return;
            attempts += 1;
            if (rootNavigationRef.isReady()) {
                navigateAscCaptureScreen(captureScreen);
                globalThis.setTimeout(() => {
                    if (!cancelled) onReady();
                }, 600);
                return;
            }
            if (attempts < 600) {
                requestAnimationFrame(tick);
            }
        };

        tick();
        return () => {
            cancelled = true;
        };
    }, [onReady, navEpoch, captureScreen]);

    return null;
}

export function E2eLayoutFixtureRoot() {
    const [bootReady, setBootReady] = useState(false);
    const [navEpoch, setNavEpoch] = useState(0);
    const [fixtureLocale, setFixtureLocale] = useState<Language | null>(null);
    const [fixturePseudoLocale, setFixturePseudoLocale] = useState(false);
    const [fixtureScreen, setFixtureScreen] = useState<AscCaptureScreen>('groups');
    const incomingUrl = Linking.useURL();
    const language = useAppStore((s) => s.language);

    useEffect(() => {
        void (async () => {
            let initialUrl = await Linking.getInitialURL();
            if (!initialUrl) {
                for (let i = 0; i < 30; i++) {
                    await new Promise((resolve) => setTimeout(resolve, 100));
                    initialUrl = await Linking.getInitialURL();
                    if (initialUrl) break;
                }
            }
            const nav = parseE2eFixtureNavigationFromUrl(initialUrl);
            const fromUrl = nav?.locale ?? parseE2eFixtureLocaleFromUrl(initialUrl);
            if (nav?.screen) {
                setFixtureScreen(nav.screen);
            }
            if (fromUrl) {
                await applyE2eFixtureLocale(fromUrl);
                setFixtureLocale(fromUrl);
                if (__DEV__) console.log(`[E2E_FIXTURE_LOCALE_APPLIED] ${fromUrl}`);
            } else {
                await initializeLanguage();
                await seedE2eLayoutFixtures(useAppStore.getState().language);
            }
            setBootReady(true);
        })();
    }, []);

    const applyFixtureLocaleFromUrl = useCallback(async (url: string | null | undefined) => {
        const nav = parseE2eFixtureNavigationFromUrl(url);
        const pseudo =
            nav?.pseudoLocale ?? parseE2eFixturePseudoLocaleFromUrl(url);
        const fromUrl = nav?.locale ?? parseE2eFixtureLocaleFromUrl(url);
        if (!fromUrl && !pseudo && !nav?.screen) return;
        if (nav?.screen) {
            setFixtureScreen(nav.screen);
        }
        if (pseudo) {
            await applyE2eFixturePseudoLocale();
            setFixturePseudoLocale(true);
            setFixtureLocale(null);
        } else if (fromUrl) {
            await applyE2eFixtureLocale(fromUrl);
            setFixtureLocale(fromUrl);
            setFixturePseudoLocale(false);
        }
        setNavEpoch((n) => n + 1);
        if (__DEV__ && fromUrl) console.log(`[E2E_FIXTURE_LOCALE_APPLIED] ${fromUrl}`);
        if (__DEV__ && pseudo) console.log('[E2E_FIXTURE_PSEUDO_LOCALE_APPLIED] xx-long');
    }, []);

    useEffect(() => {
        if (!bootReady || !incomingUrl) return;
        void applyFixtureLocaleFromUrl(incomingUrl);
    }, [bootReady, incomingUrl, applyFixtureLocaleFromUrl]);

    useEffect(() => {
        if (!bootReady) return undefined;
        const subscription = Linking.addEventListener('url', ({ url }) => {
            void applyFixtureLocaleFromUrl(url);
        });
        return () => subscription.remove();
    }, [bootReady, applyFixtureLocaleFromUrl]);

    useEffect(() => {
        if (!bootReady) return;
        void seedE2eLayoutFixtures(language);
    }, [bootReady, language]);

    const onNavReady = useCallback(() => {}, []);

    if (!bootReady) {
        return <View testID="e2e-fixture-loading" style={{ flex: 1, backgroundColor: '#ffffff' }} />;
    }

    return (
        <QueryClientProvider client={queryClient}>
            <SafeAreaProvider>
                <RtlLayoutProvider>
                    <ScreenErrorBoundary screenName="E2eLayoutFixtures">
                        <NavigationContainer ref={rootNavigationRef}>
                            <AppNavigator />
                        </NavigationContainer>
                        <E2eFixtureNavigationController
                            onReady={onNavReady}
                            navEpoch={navEpoch}
                            captureScreen={fixtureScreen}
                        />
                        {fixturePseudoLocale ? (
                            <View
                                testID="e2e-fixture-pseudo-ready"
                                accessible
                                accessibilityLabel="e2e-fixture-locale-xx-long"
                                importantForAccessibility="yes"
                                collapsable={false}
                                style={{
                                    position: 'absolute',
                                    left: 0,
                                    top: 0,
                                    width: 4,
                                    height: 4,
                                    opacity: 0.02,
                                }}
                            />
                        ) : null}
                        {fixtureLocale ? (
                            <View
                                testID="e2e-fixture-locale-ready"
                                accessible
                                accessibilityLabel={`e2e-fixture-locale-${fixtureLocale}`}
                                importantForAccessibility="yes"
                                collapsable={false}
                                style={{
                                    position: 'absolute',
                                    left: 0,
                                    top: 0,
                                    width: 4,
                                    height: 4,
                                    opacity: 0.02,
                                }}
                            />
                        ) : null}
                    </ScreenErrorBoundary>
                    <Toast config={toastConfig} topOffset={56} />
                </RtlLayoutProvider>
            </SafeAreaProvider>
        </QueryClientProvider>
    );
}
