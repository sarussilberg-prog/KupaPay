import type { Language } from '@cost-share/shared';

function localeTag(language: Language): string {
    switch (language) {
        case 'he':
            return 'he-IL';
        case 'ar':
            return 'ar';
        case 'ru':
            return 'ru-RU';
        case 'de':
            return 'de-DE';
        case 'fr':
            return 'fr-FR';
        case 'es':
            return 'es-ES';
        default:
            return 'en-US';
    }
}

export function formatSubscriptionDate(iso: string | null | undefined, language: Language): string | null {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(localeTag(language), {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}
