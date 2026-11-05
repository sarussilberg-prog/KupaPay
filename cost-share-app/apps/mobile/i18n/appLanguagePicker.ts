import type { Language } from '@cost-share/shared';
import { XX_LONG_LOCALE_CODE } from './e2ePseudoLocale';

/** Languages shown in LanguageSheet (includes E2E pseudo-locale when enabled). */
export type AppLanguagePickerCode = Language | typeof XX_LONG_LOCALE_CODE;

export function isE2ePseudoLocaleCode(
    code: AppLanguagePickerCode,
): code is typeof XX_LONG_LOCALE_CODE {
    return code === XX_LONG_LOCALE_CODE;
}
