/**
 * Lazy-loaded mobile locale JSON — keeps non-English bundles out of the initial JS chunk.
 */

import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, type Language } from '@cost-share/shared';
import en from './locales/en.json';

const localeImporters: Record<
    Exclude<Language, typeof DEFAULT_LANGUAGE>,
    () => Promise<{ default: object }>
> = {
    he: () => import('./locales/he.json'),
    ru: () => import('./locales/ru.json'),
    ar: () => import('./locales/ar.json'),
    fr: () => import('./locales/fr.json'),
    es: () => import('./locales/es.json'),
    de: () => import('./locales/de.json'),
};

export async function loadMobileLocaleTranslation(language: Language): Promise<object> {
    if (language === DEFAULT_LANGUAGE) {
        return en;
    }
    const mod = await localeImporters[language]();
    return mod.default;
}

export const MOBILE_I18N_EAGER_RESOURCES = {
    [DEFAULT_LANGUAGE]: { translation: en },
} as const;

export const MOBILE_I18N_LOCALE_CODES = [...SUPPORTED_LANGUAGES] as const;
