/**
 * Eager all-locale resources for Jest only — not imported from production entrypoints.
 */

import de from './locales/de.json';
import ar from './locales/ar.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import he from './locales/he.json';
import ru from './locales/ru.json';

export const mobileI18nResourcesAllLocales = {
    en: { translation: en },
    he: { translation: he },
    ru: { translation: ru },
    ar: { translation: ar },
    fr: { translation: fr },
    es: { translation: es },
    de: { translation: de },
} as const;
