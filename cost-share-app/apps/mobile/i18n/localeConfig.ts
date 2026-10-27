/**
 * Mobile i18n locale registry — codes and bundle loading (English eager, others lazy).
 */

import { assertAppLocaleRegistry, DEFAULT_LANGUAGE } from '@cost-share/shared';
import {
    loadMobileLocaleTranslation,
    MOBILE_I18N_EAGER_RESOURCES,
    MOBILE_I18N_LOCALE_CODES,
} from './localeLoader';

export const MOBILE_I18N_BASE_LOCALE = DEFAULT_LANGUAGE;

export { MOBILE_I18N_LOCALE_CODES, loadMobileLocaleTranslation };

/** English-only resources for the initial i18next bundle; other locales load on demand. */
export const mobileI18nResources = MOBILE_I18N_EAGER_RESOURCES;

export type MobileI18nLocaleCode = (typeof MOBILE_I18N_LOCALE_CODES)[number];

assertAppLocaleRegistry(MOBILE_I18N_LOCALE_CODES, 'mobile');
