/**
 * Supported UI languages — keep in sync with mobile locale JSON files and web landing translations.
 */

export const SUPPORTED_LANGUAGES = ['en', 'he', 'ru', 'ar', 'fr', 'es', 'de'] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'en';

/** Languages whose UI mirrors right-to-left (native + logical RTL). */
export const RTL_LANGUAGES: ReadonlySet<Language> = new Set(['he', 'ar']);

export function isLanguage(value: string | null | undefined): value is Language {
    return !!value && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export function isRtlLanguage(language: Language): boolean {
    return RTL_LANGUAGES.has(language);
}

/** BCP 47 tag for Intl (dates, numbers, display names). */
export function languageToIntlLocale(language: Language): string {
    switch (language) {
        case 'en':
            return 'en-US';
        case 'he':
            return 'he-IL';
        case 'ru':
            return 'ru-RU';
        case 'ar':
            return 'ar';
        case 'fr':
            return 'fr-FR';
        case 'es':
            return 'es-ES';
        case 'de':
            return 'de-DE';
        default: {
            const _exhaustive: never = language;
            return _exhaustive;
        }
    }
}

/** Endonym labels for the language picker (always shown in native form). */
export const LANGUAGE_NATIVE_LABELS: Record<Language, string> = {
    en: 'English',
    he: 'עברית',
    ru: 'Русский',
    ar: 'العربية',
    fr: 'Français',
    es: 'Español',
    de: 'Deutsch',
};

/**
 * @deprecated Use {@link resolveLegalDocumentLocale} from static legal loader — all UI languages have bundled markdown.
 */
export function legalDocumentLocale(language: Language): Language {
    return language;
}
