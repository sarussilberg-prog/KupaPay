import {
    assertAppLocaleRegistry,
    DEFAULT_LANGUAGE,
    type Language,
} from '@cost-share/shared';
import en from '../locales/en.json';
import he from '../locales/he.json';
import ru from '../locales/ru.json';
import ar from '../locales/ar.json';
import fr from '../locales/fr.json';
import es from '../locales/es.json';
import de from '../locales/de.json';

export type { Language };

/** Base locale for web marketing copy parity checks. */
export const WEB_I18N_BASE_LOCALE = DEFAULT_LANGUAGE;

const webI18nTranslations = {
    en,
    he,
    ru,
    ar,
    fr,
    es,
    de,
} as const satisfies Record<Language, typeof en>;

export { webI18nTranslations };

export type WebI18nLocaleCode = keyof typeof webI18nTranslations;

/** Derived from registered locale packs — not a hand-maintained list. */
export const WEB_I18N_LOCALE_CODES = Object.keys(webI18nTranslations) as WebI18nLocaleCode[];

assertAppLocaleRegistry(WEB_I18N_LOCALE_CODES, 'web');

export function getWebI18nBundles(): Record<string, unknown> {
    return { ...webI18nTranslations };
}

function isWebI18nLocale(locale: Language): locale is WebI18nLocaleCode {
    return Object.prototype.hasOwnProperty.call(webI18nTranslations, locale);
}

export type Translations = typeof en;

export function getTranslations(locale: Language): Translations {
    const pack = isWebI18nLocale(locale) ? webI18nTranslations[locale] : undefined;
    return pack ?? webI18nTranslations.en;
}
