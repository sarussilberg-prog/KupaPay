import { lifecycleEmailCopy } from '../lifecycleEmailCopy';
import { APP_I18N_LOCALE_CODES } from '../../i18n/appLocales';
import type { Language } from '../../i18n/languages';

describe('lifecycleEmailCopy', () => {
    it('returns copy for every locale and template', () => {
        for (const locale of APP_I18N_LOCALE_CODES) {
            const copy = lifecycleEmailCopy('welcome', locale);
            expect(copy.subject.length).toBeGreaterThan(0);
            expect(copy.bodyHtml).toContain('<p');
        }
    });

    it('falls back to English for unknown locale', () => {
        const copy = lifecycleEmailCopy('welcome', 'xx' as 'en');
        expect(copy.subject).toBe(lifecycleEmailCopy('welcome', 'en').subject);
    });
});
