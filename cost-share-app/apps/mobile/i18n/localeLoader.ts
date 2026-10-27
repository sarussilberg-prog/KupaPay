/**
 * Lazy-loaded mobile locale JSON — keeps non-English bundles out of the initial JS chunk.
 */

import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, type Language } from '@cost-share/shared';
import en from './locales/en.json';

export async function loadMobileLocaleTranslation(language: Language): Promise<object> {
    switch (language) {
        case 'en':
            return en;
        case 'he':
            return (await import('./locales/he.json')).default;
        case 'ru':
            return (await import('./locales/ru.json')).default;
        case 'ar':
            return (await import('./locales/ar.json')).default;
        case 'fr':
            return (await import('./locales/fr.json')).default;
        case 'es':
            return (await import('./locales/es.json')).default;
        case 'de':
            return (await import('./locales/de.json')).default;
        default: {
            const _exhaustive: never = language;
            return _exhaustive;
        }
    }
}

export const MOBILE_I18N_EAGER_RESOURCES = {
    [DEFAULT_LANGUAGE]: { translation: en },
} as const;

export const MOBILE_I18N_LOCALE_CODES = [...SUPPORTED_LANGUAGES] as const;
