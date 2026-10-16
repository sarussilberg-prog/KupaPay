import { lifecycleEmailCopy } from '@cost-share/shared';
import { APP_I18N_LOCALE_CODES } from '@cost-share/shared';

describe('lifecycleEmailCopy', () => {
    it('returns copy for every locale', () => {
        for (const locale of APP_I18N_LOCALE_CODES) {
            const copy = lifecycleEmailCopy('welcome', locale);
            expect(copy.subject.length).toBeGreaterThan(0);
        }
    });
});
