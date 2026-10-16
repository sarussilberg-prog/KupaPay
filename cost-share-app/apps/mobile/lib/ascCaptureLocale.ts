import { DEFAULT_LANGUAGE, isLanguage, type Language } from '@cost-share/shared';

/** Map App Store Connect locale tags to mobile i18n resource keys. */
export function ascLocaleToAppLanguage(locale: string): Language {
    const normalized = locale.trim().replace('_', '-');
    const base = normalized.split('-')[0]?.toLowerCase();
    if (isLanguage(base)) return base;
    if (normalized.startsWith('en')) return 'en';
    if (normalized.startsWith('he') || normalized.startsWith('iw')) return 'he';
    if (normalized.startsWith('ar')) return 'ar';
    return DEFAULT_LANGUAGE;
}
