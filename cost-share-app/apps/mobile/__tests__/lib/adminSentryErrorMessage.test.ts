import type { TFunction } from 'i18next';
import { formatAdminSentryErrorMessage } from '../../lib/adminSentryErrorMessage';
import { AdminSentryProxyError } from '../../services/adminSentry.service';

const t = ((key: string, opts?: { detail?: string; missing?: string; defaultValue?: string }) => {
    if (key === 'admin.errors.failedReasons.sentry_not_configured') {
        return `Missing: ${opts?.missing ?? ''}`;
    }
    if (key === 'admin.errors.failedReasons.unknown') {
        return 'Unknown error';
    }
    return opts?.defaultValue ?? key;
}) as TFunction;

describe('formatAdminSentryErrorMessage', () => {
    it('maps sentry_not_configured with missing secret names', () => {
        const err = new AdminSentryProxyError({
            code: 'sentry_not_configured',
            missing: ['SENTRY_API_TOKEN', 'SENTRY_PROJECT_DEV'],
        });
        const msg = formatAdminSentryErrorMessage(t, err);
        expect(msg).toContain('SENTRY_API_TOKEN');
        expect(msg).toContain('SENTRY_PROJECT_DEV');
    });

    it('falls back to the error code when no translation exists', () => {
        const err = new AdminSentryProxyError({ code: 'something_new' });
        expect(formatAdminSentryErrorMessage(t, err)).toBe('something_new');
    });
});
