import fs from 'fs';
import path from 'path';
import { MOBILE_I18N_LOCALE_CODES } from '../../i18n/localeConfig';
import { isRtlLanguage } from '@cost-share/shared';

const LOCALES_DIR = path.join(__dirname, '../../i18n/locales');
const KEYS = [
    'common.offlineBannerMessage',
    'common.screenErrorTitle',
    'common.screenErrorMessage',
    'common.offlineTitle',
    'common.retry',
] as const;

function get(obj: Record<string, unknown>, dotted: string): unknown {
    return dotted.split('.').reduce<unknown>((acc, part) => {
        if (acc && typeof acc === 'object' && part in (acc as object)) {
            return (acc as Record<string, unknown>)[part];
        }
        return undefined;
    }, obj);
}

describe('reliability i18n keys (#427)', () => {
    it('defines offline + screen-error strings in all 7 locales', () => {
        expect(MOBILE_I18N_LOCALE_CODES.length).toBe(7);
        for (const code of MOBILE_I18N_LOCALE_CODES) {
            const bundle = JSON.parse(
                fs.readFileSync(path.join(LOCALES_DIR, `${code}.json`), 'utf8'),
            ) as Record<string, unknown>;
            for (const key of KEYS) {
                const value = get(bundle, key);
                expect(typeof value).toBe('string');
                expect((value as string).trim().length).toBeGreaterThan(0);
            }
        }
    });

    it('RTL locales (he, ar) expose the same keys as LTR locales', () => {
        const rtlCodes = MOBILE_I18N_LOCALE_CODES.filter(isRtlLanguage);
        expect(rtlCodes).toEqual(expect.arrayContaining(['he', 'ar']));
        for (const code of rtlCodes) {
            const bundle = JSON.parse(
                fs.readFileSync(path.join(LOCALES_DIR, `${code}.json`), 'utf8'),
            ) as Record<string, unknown>;
            for (const key of KEYS) {
                expect(get(bundle, key)).toBeTruthy();
            }
        }
    });
});
