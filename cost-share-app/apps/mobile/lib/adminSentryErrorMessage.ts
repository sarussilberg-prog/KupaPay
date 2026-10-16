import type { TFunction } from 'i18next';
import { AdminSentryProxyError } from '../services/adminSentry.service';

/** Maps proxy / invoke failures to localized admin-facing copy (all locales). */
export function formatAdminSentryErrorMessage(t: TFunction, error: unknown): string {
    if (error instanceof AdminSentryProxyError) {
        const key = `admin.errors.failedReasons.${error.code}`;
        const translated = t(key, {
            detail: error.detail ?? '',
            missing: error.missing?.join(', ') ?? '',
            defaultValue: '',
        });
        if (translated && translated !== key) return translated;
        if (error.detail) return error.detail;
        if (error.missing?.length) {
            return `${error.code}: ${error.missing.join(', ')}`;
        }
        return error.code;
    }
    return t('admin.errors.failedReasons.unknown');
}
