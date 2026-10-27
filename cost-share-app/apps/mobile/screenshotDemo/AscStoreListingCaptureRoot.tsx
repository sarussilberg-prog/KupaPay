import React, { useEffect, useMemo, useState } from 'react';
import { View, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClientProvider } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { initializeLanguageForCapture } from '../i18n';
import { ascLocaleToAppLanguage } from '../lib/ascCaptureLocale';
import { queryClient } from '../lib/queryClient';
import { queryKeys } from '../hooks/queries/keys';
import type { MyProStatus } from '../services/proEntitlements.service';
import { useAppStore } from '../store';
import { RtlLayoutProvider } from '../hooks/useRtlLayout';
import { readAscCaptureParams } from '../lib/ascCaptureParams';
import { CAPTURE_USER_ID, captureGroups, captureSimplifiedInputs } from './ascCaptureSeed';
import { AscStoreListingFrame } from './AscStoreListingFrame';
import { renderAscCaptureScreen } from './AscCaptureScreens';

const Stack = createNativeStackNavigator();

function seedCaptureCache() {
    queryClient.setQueryData(queryKeys.groups, captureGroups);
    queryClient.setQueryData(queryKeys.simplifiedDebts, captureSimplifiedInputs);
    queryClient.setQueryData(queryKeys.groupUnreadCounts, {});
    queryClient.setQueryData(queryKeys.activityUnreadCount, 0);
    const proCaptureStatus: MyProStatus = {
        hasPro: true,
        individualProUntil: '2027-01-15T00:00:00.000Z',
        groupPassUntil: null,
        includedTripPassCredits: 0,
        unassignedTripPassCount: 0,
        adminProViewMode: 'real',
        adminProViewExpiresAt: null,
    };
    queryClient.setQueryData(queryKeys.proStatus(), proCaptureStatus);
    useAppStore.setState({
        session: { user: { id: CAPTURE_USER_ID } } as never,
        currentUser: {
            id: CAPTURE_USER_ID,
            displayName: 'Capture',
            email: 'capture@kupapay.local',
            inviteToken: 'capture123456',
            defaultCurrency: 'ILS',
            language: 'he',
            isActive: true,
            isAdmin: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        } as never,
    });
}

function CaptureNavigator({ screen }: { screen: string }) {
    const Screen = () => <>{renderAscCaptureScreen(screen as never)}</>;
    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Capture" component={Screen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}

export function AscStoreListingCaptureRoot() {
    const params = readAscCaptureParams();
    const [ready, setReady] = useState(false);
    const { t } = useTranslation();

    const locale = params?.locale ?? 'en-US';
    const screen = params?.screen ?? 'groups';
    const phoneOnly = params?.phoneOnly ?? false;
    const width = phoneOnly ? 390 : Number(process.env.EXPO_PUBLIC_CAPTURE_WIDTH ?? 1320);
    const height = phoneOnly ? 844 : Number(process.env.EXPO_PUBLIC_CAPTURE_HEIGHT ?? 2868);

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
            seedCaptureCache();
            queryClient.setQueryData(queryKeys.mySubscription(), {
                lifecycle: 'active',
                planKind: 'yearly',
                priceString: '₪69.90',
                renewalOrExpiryIso: '2027-01-15T00:00:00.000Z',
                autoRenew: true,
                store: 'app_store',
                storeProductId: 'kupapay_pro_yearly',
                storePlanId: null,
                isFreeTrial: false,
                tripPasses: [
                    {
                        groupId: 'g-barcelona',
                        groupName: 'Barcelona Trip',
                        expiresAt: '2026-12-20T00:00:00.000Z',
                    },
                ],
                serverIndividualUntil: '2027-01-15T00:00:00.000Z',
            });
            setReady(true);
        })();
    }, [locale]);

    if (!ready) {
        return <View testID="asc-demo-loading" style={{ flex: 1, backgroundColor: '#1e3a8a' }} />;
    }

    return (
        <QueryClientProvider client={queryClient}>
            <RtlLayoutProvider>
                <View
                    testID="asc-capture-ready"
                    style={{
                        flex: 1,
                        width,
                        height,
                        alignSelf: 'center',
                        backgroundColor: phoneOnly ? '#f1f5f9' : undefined,
                    }}
                >
                    {phoneOnly ? (
                        <CaptureNavigator screen={screen} />
                    ) : (
                        <AscStoreListingFrame
                            width={width}
                            height={height}
                            headline={headline}
                            subline={t('app.name', 'KupaPay')}
                        >
                            <CaptureNavigator screen={screen} />
                        </AscStoreListingFrame>
                    )}
                </View>
            </RtlLayoutProvider>
        </QueryClientProvider>
    );
}
