import { NextRequest, NextResponse } from 'next/server';
import { type Language } from '@cost-share/shared';
import { MARKETING_LOCALE_HEADER } from '@/lib/marketingSeo';
import {
    LOCALE_COOKIE,
    ONE_YEAR_LOCALE_COOKIE_MAX_AGE,
    resolveMarketingMiddleware,
} from '@/lib/marketingMiddlewareLogic';

function withLocaleCookie(response: NextResponse, locale: Language): NextResponse {
    response.cookies.set(LOCALE_COOKIE, locale, {
        path: '/',
        maxAge: ONE_YEAR_LOCALE_COOKIE_MAX_AGE,
        sameSite: 'lax',
    });
    response.headers.set(MARKETING_LOCALE_HEADER, locale);
    return response;
}

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const action = resolveMarketingMiddleware(pathname, {
        cookieLocale: request.cookies.get(LOCALE_COOKIE)?.value,
        acceptLanguage: request.headers.get('accept-language'),
    });

    if (action.kind === 'redirect_root') {
        return withLocaleCookie(
            NextResponse.redirect(new URL(`/${action.locale}`, request.url), 307),
            action.locale,
        );
    }

    if (action.kind === 'continue_marketing_locale') {
        return withLocaleCookie(NextResponse.next(), action.locale);
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/',
        '/:locale(en|he|ru|ar|fr|es|de)',
        '/:locale(en|he|ru|ar|fr|es|de)/split-calculator',
        '/:locale(en|he|ru|ar|fr|es|de)/:slug(trip-expenses|roommate-bills|event-expenses|couple-expenses)',
    ],
};
