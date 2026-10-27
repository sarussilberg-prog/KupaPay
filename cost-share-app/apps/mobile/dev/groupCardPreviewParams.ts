import { isLanguage, type Language } from '@cost-share/shared';

export type GroupCardPreviewTheme = 'light' | 'dark';
export type GroupCardDesignOption = 'a' | 'b' | 'c';

export type GroupCardPreviewParams = {
    lang: Language;
    theme: GroupCardPreviewTheme;
    option: GroupCardDesignOption;
    stress: boolean;
};

function readSearchParams(): URLSearchParams | null {
    if (typeof globalThis.location === 'undefined') return null;
    return new URLSearchParams(globalThis.location.search);
}

function parseOption(raw: string | null | undefined): GroupCardDesignOption {
    const v = raw?.toLowerCase();
    if (v === 'b' || v === '2') return 'b';
    if (v === 'c' || v === '3') return 'c';
    return 'a';
}

export function readGroupCardPreviewParams(): GroupCardPreviewParams {
    const params = readSearchParams();
    const rawLang = params?.get('lang');
    const lang = isLanguage(rawLang) ? rawLang : 'en';
    const theme = params?.get('theme') === 'dark' ? 'dark' : 'light';
    return {
        lang,
        theme,
        option: parseOption(params?.get('option')),
        stress: params?.get('stress') === '1',
    };
}

export function applyGroupCardPreviewDocumentTheme(theme: GroupCardPreviewTheme): void {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('dark', theme === 'dark');
}
