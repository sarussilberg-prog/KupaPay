import { isLanguage, type Language } from '@cost-share/shared';

export type GroupsListPreviewTheme = 'light' | 'dark';

export type GroupsListPreviewParams = {
    lang: Language;
    theme: GroupsListPreviewTheme;
    narrow: boolean;
    stress: boolean;
};

function readSearchParams(): URLSearchParams | null {
    if (typeof globalThis.location === 'undefined') return null;
    return new URLSearchParams(globalThis.location.search);
}

export function readGroupsListPreviewParams(): GroupsListPreviewParams {
    const params = readSearchParams();
    const rawLang = params?.get('lang');
    const lang = isLanguage(rawLang) ? rawLang : 'en';
    const theme = params?.get('theme') === 'dark' ? 'dark' : 'light';
    return {
        lang,
        theme,
        narrow: params?.get('narrow') === '1',
        stress: params?.get('stress') === '1',
    };
}

export function applyGroupsListPreviewDocumentTheme(theme: GroupsListPreviewTheme): void {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('dark', theme === 'dark');
}
