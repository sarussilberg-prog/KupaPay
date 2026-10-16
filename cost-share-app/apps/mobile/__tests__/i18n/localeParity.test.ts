import fs from 'fs';
import path from 'path';
import {
    compareLocaleToBase,
    findUntranslatedFromBase,
    flattenLocale,
    isAllowlistedLocaleValue,
    isRtlLanguage,
    runLocaleParityForApp,
} from '@cost-share/shared';
import {
    getMobileI18nBundles,
    MOBILE_I18N_BASE_LOCALE,
    MOBILE_I18N_LOCALE_CODES,
} from '../../i18n/localeConfig';
import {
    getWebI18nBundles,
    WEB_I18N_BASE_LOCALE,
    WEB_I18N_LOCALE_CODES,
} from '../../../web/lib/i18n';

const LOCALES_DIR = path.join(__dirname, '../../i18n/locales');

function loadLocaleFile(code: string): unknown {
    const file = path.join(LOCALES_DIR, `${code}.json`);
    expect(fs.existsSync(file)).toBe(true);
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function formatParityIssues(
    issues: ReturnType<typeof runLocaleParityForApp>,
): string {
    return issues
        .slice(0, 40)
        .map(i => {
            if (i.kind === 'placeholder_mismatch') {
                return `${i.locale} ${i.key} placeholders ${i.other.join(',')} vs ${i.base.join(',')}`;
            }
            return `${i.locale} ${i.kind} ${i.key}`;
        })
        .join('\n');
}

describe('i18n locale parity (config-driven)', () => {
    it('mobile locale codes come from mobileI18nResources registry', () => {
        expect(MOBILE_I18N_LOCALE_CODES).toEqual(
            expect.arrayContaining(['en', 'he', 'ru', 'ar', 'fr', 'es', 'de']),
        );
        expect(MOBILE_I18N_LOCALE_CODES.length).toBe(7);
    });

    it('web locale codes come from webI18nTranslations registry', () => {
        expect(WEB_I18N_LOCALE_CODES.length).toBeGreaterThanOrEqual(2);
        expect(WEB_I18N_LOCALE_CODES).toContain(WEB_I18N_BASE_LOCALE);
    });

    it('mobile: every configured locale matches en keys (no missing/empty/placeholder drift)', () => {
        const issues = runLocaleParityForApp({
            appLabel: 'mobile',
            baseLocale: MOBILE_I18N_BASE_LOCALE,
            bundles: getMobileI18nBundles(),
            allowExtraKeys: true,
        });
        expect(issues).toEqual([]);
        if (issues.length) {
            throw new Error(formatParityIssues(issues));
        }
    });

    it('web: every configured locale matches en keys (no missing/empty/placeholder drift)', () => {
        const issues = runLocaleParityForApp({
            appLabel: 'web',
            baseLocale: WEB_I18N_BASE_LOCALE,
            bundles: getWebI18nBundles(),
            allowExtraKeys: true,
        });
        expect(issues).toEqual([]);
        if (issues.length) {
            throw new Error(formatParityIssues(issues));
        }
    });
});

describe('mobile locale files (legacy checks)', () => {
    it('treats Arabic as RTL like Hebrew', () => {
        expect(isRtlLanguage('ar')).toBe(true);
        expect(isRtlLanguage('he')).toBe(true);
        expect(isRtlLanguage('en')).toBe(false);
    });

    const baseFlat = flattenLocale(loadLocaleFile(MOBILE_I18N_BASE_LOCALE));
    const heFlat = flattenLocale(loadLocaleFile('he'));

    it('English includes Hebrew _two/_many plural keys (KI-013)', () => {
        const pluralSuffix = /_(two|many)$/;
        const missingInEn = Object.keys(heFlat).filter(
            key => pluralSuffix.test(key) && !(key in baseFlat),
        );
        expect(missingInEn).toEqual([]);
    });

    it.each(MOBILE_I18N_LOCALE_CODES.filter(l => l !== MOBILE_I18N_BASE_LOCALE))(
        '%s has all base keys and matching interpolation placeholders',
        locale => {
            const flat = flattenLocale(loadLocaleFile(locale));
            const issues = compareLocaleToBase(baseFlat, flat, locale, { allowExtraKeys: true });
            const missing = issues.filter(i => i.kind === 'missing_key');
            const placeholders = issues.filter(i => i.kind === 'placeholder_mismatch');
            const empty = issues.filter(i => i.kind === 'empty_value');
            expect(missing).toEqual([]);
            expect(placeholders).toEqual([]);
            expect(empty).toEqual([]);
        },
    );

    it.each(MOBILE_I18N_LOCALE_CODES.filter(l => l !== MOBILE_I18N_BASE_LOCALE))(
        '%s has no untranslated strings identical to English',
        locale => {
            const flat = flattenLocale(loadLocaleFile(locale));
            const untranslated = findUntranslatedFromBase(baseFlat, flat, locale, (value, key) =>
                isAllowlistedLocaleValue(value, key),
            );
            expect(untranslated).toEqual([]);
        },
    );
});
