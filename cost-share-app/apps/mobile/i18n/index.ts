/**
 * i18n Configuration
 * Internationalization setup with AsyncStorage persistence.
 *
 * Adding a new language:
 *   1. Update `Language` in @cost-share/shared.
 *   2. Add a `./locales/<code>.json` file and an entry in `resources` below.
 *   3. If the new language is RTL, add its code to `RTL_LANGUAGES`.
 * Device-locale detection, fallback, and persistence then work without further changes.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DevSettings, I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import * as Updates from 'expo-updates';
import type { Language } from '@cost-share/shared';
import en from './locales/en.json';
import he from './locales/he.json';
import { useAppStore } from '../store';

type SupportedLanguage = Language;

const resources: Record<SupportedLanguage, { translation: object }> = {
    en: { translation: en },
    he: { translation: he },
};

const SUPPORTED_LANGUAGES = Object.keys(resources) as readonly SupportedLanguage[];

const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

/** Languages whose script is right-to-left. Add new RTL languages (e.g. 'ar', 'fa', 'ur') here. */
const RTL_LANGUAGES = new Set<SupportedLanguage>(['he']);

// Java's `Locale.getLanguage()` returns deprecated ISO 639-1 codes for backwards
// compatibility — Hebrew is "iw" (not "he"), Indonesian is "in" (not "id"), Yiddish
// is "ji" (not "yi"). Android surfaces these via expo-localization's `languageCode`.
// iOS returns modern codes. Map legacy → modern so detection works on both platforms.
const LEGACY_LANGUAGE_CODE_MAP: Readonly<Record<string, string>> = {
    iw: 'he',
    in: 'id',
    ji: 'yi',
};

const normalizeLanguageCode = (code: string | null | undefined): string | null => {
    if (!code) return null;
    const lower = code.toLowerCase();
    return LEGACY_LANGUAGE_CODE_MAP[lower] ?? lower;
};

const isSupportedLanguage = (code: string | null | undefined): code is SupportedLanguage =>
    !!code && (SUPPORTED_LANGUAGES as readonly string[]).includes(code);

/** Picks the first device-preferred locale we have a translation for. Falls back to the default. */
const resolveDeviceLanguage = (): SupportedLanguage => {
    try {
        for (const locale of Localization.getLocales()) {
            const fromCode = normalizeLanguageCode(locale?.languageCode);
            if (isSupportedLanguage(fromCode)) return fromCode;
            const tagPrefix = locale?.languageTag?.toLowerCase().split('-')[0];
            const fromTag = normalizeLanguageCode(tagPrefix);
            if (isSupportedLanguage(fromTag)) return fromTag;
        }
        return DEFAULT_LANGUAGE;
    } catch {
        console.warn(
            'expo-localization unavailable — rebuild the dev client (npm run mobile:ios). Using default.',
        );
        return DEFAULT_LANGUAGE;
    }
};

I18nManager.allowRTL(true);

const LANGUAGE_KEY = '@app_language';
/** Last language we already ran forceRTL + reload for (prevents Android dev reload loops). */
const RTL_NATIVE_APPLIED_KEY = '@rtl_native_applied';

const i18nInitOptions = {
    resources,
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: {
        escapeValue: false,
    },
    compatibilityJSON: 'v4' as const,
};

let initPromise: Promise<void> | null = null;

async function ensureI18nReady(language: SupportedLanguage): Promise<void> {
    if (!i18n.isInitialized) {
        if (!initPromise) {
            initPromise = i18n.use(initReactI18next).init({
                ...i18nInitOptions,
                lng: language,
            }).then(() => undefined);
        }
        await initPromise;
        return;
    }

    if (i18n.language !== language) {
        await i18n.changeLanguage(language);
    }
}

async function syncNativeRtl(language: SupportedLanguage): Promise<void> {
    const desiredRTL = RTL_LANGUAGES.has(language);
    if (I18nManager.isRTL === desiredRTL) {
        await AsyncStorage.setItem(RTL_NATIVE_APPLIED_KEY, language);
        return;
    }

    const applied = await AsyncStorage.getItem(RTL_NATIVE_APPLIED_KEY);
    if (applied === language) {
        // forceRTL + reload already ran for this language but native isRTL can stay
        // wrong on Android dev builds — RtlLayoutProvider still mirrors from store.
        if (__DEV__) {
            console.warn(
                '[i18n] Native I18nManager.isRTL still mismatched after reload; using logical RTL.',
            );
        }
        return;
    }

    I18nManager.forceRTL(desiredRTL);
    await AsyncStorage.setItem(RTL_NATIVE_APPLIED_KEY, language);
    if (__DEV__) {
        // Updates.reloadAsync() in a dev client can leave the splash stuck.
        DevSettings.reload();
    } else {
        await Updates.reloadAsync();
    }
    // Execution stops here — the app reloads.
}

async function resolveStartupLanguage(): Promise<SupportedLanguage> {
    const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);

    if (isSupportedLanguage(savedLanguage)) {
        return savedLanguage;
    }

    const deviceLanguage = resolveDeviceLanguage();
    await AsyncStorage.setItem(LANGUAGE_KEY, deviceLanguage);
    return deviceLanguage;
}

/**
 * Initialize language from AsyncStorage on app start
 * Loads saved language preference and applies RTL settings
 */
export const initializeLanguage = async (): Promise<void> => {
    try {
        const language = await resolveStartupLanguage();
        await ensureI18nReady(language);
        useAppStore.getState().setLanguage(language);
        await syncNativeRtl(language);
        if (__DEV__) console.log(`Language initialized: ${language}`);
    } catch (error) {
        console.error('Failed to initialize language:', error);
        await ensureI18nReady(DEFAULT_LANGUAGE);
        useAppStore.getState().setLanguage(DEFAULT_LANGUAGE);
    }
};

/**
 * Change language and update RTL settings
 * Saves preference to AsyncStorage for persistence
 */
export const changeLanguage = async (language: SupportedLanguage): Promise<void> => {
    try {
        await ensureI18nReady(language);
        await i18n.changeLanguage(language);
        await AsyncStorage.setItem(LANGUAGE_KEY, language);
        useAppStore.getState().setLanguage(language);
        if (__DEV__) console.log(`Language saved to storage: ${language}`);
        await syncNativeRtl(language);
    } catch (error) {
        console.error('Failed to change language:', error);
        throw error;
    }
};

/**
 * Get current saved language from AsyncStorage
 */
export const getSavedLanguage = async (): Promise<SupportedLanguage | null> => {
    try {
        const language = await AsyncStorage.getItem(LANGUAGE_KEY);
        return isSupportedLanguage(language) ? language : null;
    } catch (error) {
        console.error('Failed to get saved language:', error);
        return null;
    }
};

export default i18n;
