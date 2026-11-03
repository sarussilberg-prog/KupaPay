import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '../i18n';
import type { AppLanguagePickerCode } from '../i18n/appLanguagePicker';
import { platformAlert } from '../lib/platformAlert';

/**
 * Single entry point for in-app language changes (login, settings, etc.).
 * Persists to AsyncStorage, updates i18n + Zustand, and syncs native RTL.
 */
export function useChangeAppLanguage() {
    const { t } = useTranslation();

    return useCallback(
        async (lang: AppLanguagePickerCode) => {
            try {
                await changeLanguage(lang);
            } catch {
                platformAlert(t('common.error'), t('profile.languageChangeError'));
            }
        },
        [t],
    );
}
