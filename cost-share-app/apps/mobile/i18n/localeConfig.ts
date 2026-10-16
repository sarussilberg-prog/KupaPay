/**
 * Mobile i18n locale registry — single source for resource bundles and configured codes.
 */

import { assertAppLocaleRegistry, DEFAULT_LANGUAGE, type Language } from '@cost-share/shared';
import en from './locales/en.json';
import he from './locales/he.json';
import ru from './locales/ru.json';
import ar from './locales/ar.json';
import fr from './locales/fr.json';
import es from './locales/es.json';
import de from './locales/de.json';

export const MOBILE_I18N_BASE_LOCALE = DEFAULT_LANGUAGE;

export const mobileI18nResources = {
    en: { translation: en },
    he: { translation: he },
    ru: { translation: ru },
    ar: { translation: ar },
    fr: { translation: fr },
    es: { translation: es },
    de: { translation: de },
} as const satisfies Record<Language, { translation: object }>;

export type MobileI18nLocaleCode = keyof typeof mobileI18nResources;

/** Derived from `mobileI18nResources` — not a hand-maintained list. */
export const MOBILE_I18N_LOCALE_CODES = Object.keys(mobileI18nResources) as MobileI18nLocaleCode[];

assertAppLocaleRegistry(MOBILE_I18N_LOCALE_CODES, 'mobile');

export function getMobileI18nBundles(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const code of MOBILE_I18N_LOCALE_CODES) {
        out[code] = mobileI18nResources[code].translation;
    }
    return out;
}
