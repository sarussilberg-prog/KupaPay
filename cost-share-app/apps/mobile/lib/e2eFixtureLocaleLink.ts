import * as Linking from 'expo-linking';
import { isLanguage, type Language } from '@cost-share/shared';
import type { AscCaptureScreen } from './ascCaptureParams';
import { XX_LONG_LOCALE_CODE } from '../i18n/e2ePseudoLocale';
import { isE2eLayoutFixturesEnabled } from './e2eLayoutFixtures';

const E2E_FIXTURE_SCREENS: AscCaptureScreen[] = [
    'groups',
    'balances',
    'add-expense',
    'simplified-debts',
    'pro-currency',
    'pro-paywall',
    'settings-pro',
];

function screenFromFixtureQuery(url: string): AscCaptureScreen {
    const parsed = Linking.parse(url);
    const raw = parsed.queryParams?.screen;
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value === 'string' && (E2E_FIXTURE_SCREENS as string[]).includes(value)) {
        return value as AscCaptureScreen;
    }
    if (url.includes('screen=pro-paywall')) return 'pro-paywall';
    return 'groups';
}

function localeFromFixtureQuery(url: string): Language | null {
    const parsed = Linking.parse(url);
    const host = parsed.hostname ?? '';
    const path = parsed.path ?? '';
    const isFixtureHost =
        host === 'e2e-fixture' ||
        path.includes('e2e-fixture') ||
        /[/?]e2e-fixture/.test(url);
    if (!isFixtureHost) return null;
    const raw = parsed.queryParams?.locale ?? parsed.queryParams?.lang;
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value !== 'string') return null;
    return isLanguage(value) ? value : null;
}

/** Maestro: `com.kupapay.mobile://e2e-fixture?locale=he` (Modal language sheet is not reliably visible to Maestro). */
export function parseE2eFixtureLocaleFromUrl(url: string | null | undefined): Language | null {
    if (!url?.trim() || !isE2eLayoutFixturesEnabled()) return null;
    const direct = localeFromFixtureQuery(url);
    if (direct) return direct;
    if (!url.includes('e2e-fixture')) return null;
    const match = url.match(/[?&](?:locale|lang)=([a-z]{2}(?:-[a-z]+)?)/i);
    if (match && isLanguage(match[1])) return match[1];
    return null;
}

/** Maestro: `com.kupapay.mobile://e2e-fixture?lang=xx-long` (pseudo-locale; Settings sheet is flaky for xx-long). */
export function parseE2eFixturePseudoLocaleFromUrl(url: string | null | undefined): boolean {
    if (
        !url?.trim() ||
        !isE2eLayoutFixturesEnabled() ||
        process.env.EXPO_PUBLIC_E2E_XX_LONG_LOCALE !== 'true'
    ) {
        return false;
    }
    if (!url.includes('e2e-fixture')) return false;
    const parsed = Linking.parse(url);
    const raw = parsed.queryParams?.locale ?? parsed.queryParams?.lang;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return value === XX_LONG_LOCALE_CODE;
}

/** Maestro: `com.kupapay.mobile://e2e-fixture?locale=he&screen=pro-paywall` */
export function parseE2eFixtureNavigationFromUrl(
    url: string | null | undefined,
): { locale: Language | null; pseudoLocale: boolean; screen: AscCaptureScreen } | null {
    if (!url?.trim() || !isE2eLayoutFixturesEnabled()) return null;
    if (!url.includes('e2e-fixture')) return null;
    return {
        locale: parseE2eFixtureLocaleFromUrl(url),
        pseudoLocale: parseE2eFixturePseudoLocaleFromUrl(url),
        screen: screenFromFixtureQuery(url),
    };
}
