import { NextRequest, NextResponse } from 'next/server';
import {
    DEFAULT_LANGUAGE,
    isLanguage,
    SUPPORTED_LANGUAGES,
    type Language,
} from '@cost-share/shared';
import { MARKETING_LOCALE_HEADER } from '@/lib/marketingSeo';

const LOCALE_COOKIE = 'locale';
const ONE_YEAR = 365 * 24 * 60 * 60;

function normalizeLang(value: string | null | undefined): Language | null {
    if (!value) return null;
    const lang = value.split('-')[0].trim().toLowerCase();
    return isLanguage(lang) ? lang : null;
}

function detectLocale(request: NextRequest): Language {
    const fromCookie = normalizeLang(request.cookies.get(LOCALE_COOKIE)?.value);
    if (fromCookie) return fromCookie;

    const accept = request.headers.get('accept-language');
    if (accept) {
        for (const tag of accept.split(',').map((s) => s.split(';')[0])) {
            const lang = normalizeLang(tag);
            if (lang) return lang;
        }
    }
    return DEFAULT_LANGUAGE;
}

function withLocaleCookie(response: NextResponse, locale: Language): NextResponse {
    response.cookies.set(LOCALE_COOKIE, locale, {
        path: '/',
        maxAge: ONE_YEAR,
        sameSite: 'lax',
    });
    response.headers.set(MARKETING_LOCALE_HEADER, locale);
    return response;
}

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    if (pathname === '/') {
        const locale = detectLocale(request);
        return withLocaleCookie(
            NextResponse.redirect(new URL(`/${locale}`, request.url), 307),
            locale,
        );
    }

    const segment = pathname.slice(1).split('/')[0];
    if (
        pathname.match(/^\/[a-z]{2}\/?$/) &&
        (SUPPORTED_LANGUAGES as readonly string[]).includes(segment)
    ) {
        return withLocaleCookie(NextResponse.next(), segment as Language);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/', '/:locale(en|he|ru|ar|fr|es|de)'],
};
