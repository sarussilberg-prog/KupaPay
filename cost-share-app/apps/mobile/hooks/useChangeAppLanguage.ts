import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Language } from '@cost-share/shared';
import { changeLanguage, type ChangeableAppLanguage } from '../i18n';
import { XX_LONG_LOCALE_CODE } from '../i18n/e2ePseudoLocale';
import { platformAlert } from '../lib/platformAlert';

/**
 * Single entry point for in-app language changes (login, settings, etc.).
 * Persists to AsyncStorage, updates i18n + Zustand, and syncs native RTL.
 */
export function useChangeAppLanguage() {
    const { t } = useTranslation();

    return useCallback(
        async (lang: Language | typeof XX_LONG_LOCALE_CODE) => {
            try {
                await changeLanguage(lang as ChangeableAppLanguage);
            } catch {
                platformAlert(t('common.error'), t('profile.languageChangeError'));
            }
        },
        [t],
    );
}
