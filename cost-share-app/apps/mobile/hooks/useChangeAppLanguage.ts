import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Language } from '@cost-share/shared';
import { changeLanguage } from '../i18n';
import { platformAlert } from '../lib/platformAlert';

/**
 * Single entry point for in-app language changes (login, settings, etc.).
 * Persists to AsyncStorage, updates i18n + Zustand, and syncs native RTL.
 */
export function useChangeAppLanguage() {
    const { t } = useTranslation();

    return useCallback(
        async (lang: Language) => {
            try {
                await changeLanguage(lang);
            } catch {
                platformAlert(t('common.error'), t('profile.languageChangeError'));
            }
        },
        [t],
    );
}
