import fs from 'fs';
import path from 'path';
import {
    SUPPORTED_LANGUAGES,
    compareLocaleToBase,
    flattenLocale,
    isRtlLanguage,
    type Language,
} from '@cost-share/shared';

const LOCALES_DIR = path.join(__dirname, '../../i18n/locales');
const BASE_LOCALE: Language = 'en';

function loadLocale(code: Language): unknown {
    const file = path.join(LOCALES_DIR, `${code}.json`);
    expect(fs.existsSync(file)).toBe(true);
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

describe('mobile locale files', () => {
    it('treats Arabic as RTL like Hebrew', () => {
        expect(isRtlLanguage('ar')).toBe(true);
        expect(isRtlLanguage('he')).toBe(true);
        expect(isRtlLanguage('en')).toBe(false);
    });

    const baseFlat = flattenLocale(loadLocale(BASE_LOCALE));

    it.each(SUPPORTED_LANGUAGES.filter((l) => l !== BASE_LOCALE))(
        '%s has all base keys and matching interpolation placeholders',
        (locale) => {
            const flat = flattenLocale(loadLocale(locale));
            const issues = compareLocaleToBase(baseFlat, flat, locale, { allowExtraKeys: true });
            const missing = issues.filter((i) => i.kind === 'missing_key');
            const placeholders = issues.filter((i) => i.kind === 'placeholder_mismatch');
            expect(missing).toEqual([]);
            expect(placeholders).toEqual([]);
        },
    );
});
