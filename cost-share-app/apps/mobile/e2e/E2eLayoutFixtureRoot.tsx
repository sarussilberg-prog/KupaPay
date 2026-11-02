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
import { parseE2eFixtureLocaleFromUrl } from '../lib/e2eFixtureLocaleLink';
import { applyE2eFixtureLocale } from './applyE2eFixtureLocale';
import { seedE2eLayoutFixtures } from './seedE2eLayoutFixtures';
import { ScreenErrorBoundary } from '../components/ScreenErrorBoundary';

function E2eFixtureNavigationController({
    onReady,
    navEpoch,
}: {
    onReady: () => void;
    navEpoch: number;
}) {
    useEffect(() => {
        let cancelled = false;
        let attempts = 0;

        const tick = () => {
            if (cancelled) return;
            attempts += 1;
            if (rootNavigationRef.isReady()) {
                navigateAscCaptureScreen('groups');
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
    }, [onReady, navEpoch]);

    return null;
}

export function E2eLayoutFixtureRoot() {
    const [bootReady, setBootReady] = useState(false);
    const [navEpoch, setNavEpoch] = useState(0);
    const [fixtureLocale, setFixtureLocale] = useState<Language | null>(null);
    const incomingUrl = Linking.useURL();
    const language = useAppStore((s) => s.language);

    useEffect(() => {
        void (async () => {
            const initialUrl = await Linking.getInitialURL();
            const fromUrl = parseE2eFixtureLocaleFromUrl(initialUrl);
            if (fromUrl) {
                await applyE2eFixtureLocale(fromUrl);
                setFixtureLocale(fromUrl);
            } else {
                await initializeLanguage();
                await seedE2eLayoutFixtures(useAppStore.getState().language);
            }
            setBootReady(true);
        })();
    }, []);

    useEffect(() => {
        if (!bootReady || !incomingUrl) return;
        const fromUrl = parseE2eFixtureLocaleFromUrl(incomingUrl);
        if (!fromUrl) return;
        void (async () => {
            await applyE2eFixtureLocale(fromUrl);
            setFixtureLocale(fromUrl);
            setNavEpoch((n) => n + 1);
        })();
    }, [bootReady, incomingUrl]);

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
                        <E2eFixtureNavigationController onReady={onNavReady} navEpoch={navEpoch} />
                        {fixtureLocale ? (
                            <View
                                testID="e2e-fixture-locale-ready"
                                accessibilityElementsHidden
                                importantForAccessibility="no-hide-descendants"
                                style={{ width: 1, height: 1, opacity: 0 }}
                            />
                        ) : null}
                    </ScreenErrorBoundary>
                    <Toast config={toastConfig} topOffset={56} />
                </RtlLayoutProvider>
            </SafeAreaProvider>
        </QueryClientProvider>
    );
}
