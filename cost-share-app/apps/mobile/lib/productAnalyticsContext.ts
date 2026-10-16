import { Platform } from 'react-native';
import Constants from 'expo-constants';
import {
    APP_VERSION,
    type ProductAnalyticsContext,
    type ProductAnalyticsPlatform,
} from '@cost-share/shared';
import i18n from '../i18n';

function resolvePlatform(): ProductAnalyticsPlatform {
    const os = Platform.OS;
    if (os === 'ios' || os === 'android' || os === 'web') return os;
    return 'android';
}

/** Runtime context attached to every product analytics event. */
export function getProductAnalyticsContext(): ProductAnalyticsContext {
    const version =
        Constants.expoConfig?.version?.trim() ||
        (Constants.manifest2 as { extra?: { expoClient?: { version?: string } } } | undefined)
            ?.extra?.expoClient?.version?.trim() ||
        APP_VERSION;
    const rawLocale = i18n.language?.trim() || 'en';
    const locale = rawLocale.split('-')[0]?.toLowerCase() || 'en';
    return {
        platform: resolvePlatform(),
        appVersion: version,
        locale,
    };
}
