import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { initializeLanguageForCapture } from '../i18n';
import { ascLocaleToAppLanguage } from '../lib/ascCaptureLocale';
import { queryClient } from '../lib/queryClient';
import { readAscCaptureParams } from '../lib/ascCaptureParams';
import type { AscCaptureScreen } from '../lib/ascCaptureParams';
import { RtlLayoutProvider } from '../hooks/useRtlLayout';
import { AppNavigator } from '../navigation/AppNavigator';
import { rootNavigationRef } from '../lib/rootNavigationRef';
import { AscStoreListingFrame } from './AscStoreListingFrame';
import { CapturePhoneShell } from '../components/capture/CapturePhoneShell';
import { seedAscCaptureApp } from './seedAscCaptureApp';
import { AscCaptureNavigationController } from './AscCaptureNavigationController';
import { renderAscCaptureScreen } from './AscCaptureScreens';

export function AscStoreListingCaptureRoot() {
    const params = readAscCaptureParams();
    const [bootReady, setBootReady] = useState(false);
    const [navReady, setNavReady] = useState(false);
    const { t } = useTranslation();

    const locale = params?.locale ?? 'en-US';
    const screen = (params?.screen ?? 'groups') as AscCaptureScreen;
    const phoneOnly = params?.phoneOnly ?? false;

    const headline = useMemo(() => {
        if (Platform.OS === 'web' && typeof globalThis.location !== 'undefined') {
            const h = new URLSearchParams(globalThis.location.search).get('headline');
            if (h) return h;
        }
        return 'KupaPay';
    }, [locale, screen]);

    useEffect(() => {
        void (async () => {
            const appLang = ascLocaleToAppLanguage(locale);
            await initializeLanguageForCapture(appLang);
            if (Platform.OS === 'web' && typeof document !== 'undefined') {
                const rtl = appLang === 'he' || appLang === 'ar';
                document.documentElement.dir = rtl ? 'rtl' : 'ltr';
                document.documentElement.lang = locale;
            }
            seedAscCaptureApp(appLang);
            setBootReady(true);
        })();
    }, [locale]);

    const onNavReady = useCallback(() => setNavReady(true), []);

    if (!bootReady) {
        return <View testID="asc-demo-loading" style={{ flex: 1, backgroundColor: '#1e3a8a' }} />;
    }

    const realApp = (
        <>
            <NavigationContainer ref={rootNavigationRef}>
                <AppNavigator />
            </NavigationContainer>
            <AscCaptureNavigationController screen={screen} onReady={onNavReady} />
        </>
    );

    const legacyPaywallOnly =
        screen === 'settings-pro' ? (
            <View style={{ flex: 1 }}>{renderAscCaptureScreen(screen)}</View>
        ) : null;

    const appChrome = (
        <CapturePhoneShell fullBleed>{legacyPaywallOnly ?? realApp}</CapturePhoneShell>
    );

    return (
        <QueryClientProvider client={queryClient}>
            <RtlLayoutProvider>
                <View
                    testID={navReady ? 'asc-capture-ready' : 'asc-demo-loading'}
                    style={{
                        flex: 1,
                        width: '100%',
                        height: '100%',
                        backgroundColor: phoneOnly ? '#f1f5f9' : '#f1f5f9',
                    }}
                >
                    {phoneOnly ? appChrome : (
                        <AscStoreListingFrame headline={headline} subline={t('app.name', 'KupaPay')}>
                            {appChrome}
                        </AscStoreListingFrame>
                    )}
                </View>
            </RtlLayoutProvider>
        </QueryClientProvider>
    );
}
