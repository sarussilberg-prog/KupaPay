import { isLanguage, type Language } from '@cost-share/shared';

export type SettingsRowPreviewParams = {
    lang: Language;
};

function readSearchParams(): URLSearchParams | null {
    if (typeof globalThis.location === 'undefined') return null;
    return new URLSearchParams(globalThis.location.search);
}

export function readSettingsRowPreviewParams(): SettingsRowPreviewParams {
    const params = readSearchParams();
    const rawLang = params?.get('lang');
    const lang = isLanguage(rawLang) ? rawLang : 'he';
    return { lang };
}
