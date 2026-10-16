/**
 * Single source for which locale codes mobile and web must both register.
 */

import { SUPPORTED_LANGUAGES, type Language } from './languages';

/** App-wide UI locales — identical to `SUPPORTED_LANGUAGES`. */
export const APP_I18N_LOCALE_CODES: readonly Language[] = SUPPORTED_LANGUAGES;

export function assertAppLocaleRegistry(
    registeredCodes: readonly string[],
    appLabel: 'mobile' | 'web',
): void {
    const expected = [...APP_I18N_LOCALE_CODES].sort((a, b) => a.localeCompare(b));
    const actual = [...registeredCodes].sort((a, b) => a.localeCompare(b));
    if (expected.length !== actual.length || expected.some((code, i) => code !== actual[i])) {
        throw new Error(
            `${appLabel} i18n must register exactly APP_I18N_LOCALE_CODES [${expected.join(', ')}]; got [${actual.join(', ')}]`,
        );
    }
}
