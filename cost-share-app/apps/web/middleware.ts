import { NextRequest, NextResponse } from 'next/server';
import { type Language } from '@cost-share/shared';
import { MARKETING_LOCALE_HEADER } from '@/lib/marketingSeo';
import {
    ambassadorRefFromRequestUrl,
    applyAmbassadorRefCookie,
} from '@/lib/ambassadorRefCookie';
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

function withAmbassadorRefCookie(response: NextResponse, request: NextRequest): NextResponse {
    const code = ambassadorRefFromRequestUrl(request.nextUrl);
    if (code) {
        applyAmbassadorRefCookie(response, code);
    }
    return response;
}

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const action = resolveMarketingMiddleware(pathname, {
        cookieLocale: request.cookies.get(LOCALE_COOKIE)?.value,
        acceptLanguage: request.headers.get('accept-language'),
    });

    if (action.kind === 'redirect_root') {
        return withAmbassadorRefCookie(
            withLocaleCookie(
                NextResponse.redirect(new URL(`/${action.locale}`, request.url), 307),
                action.locale,
            ),
            request,
        );
    }

    if (action.kind === 'continue_marketing_locale') {
        return withAmbassadorRefCookie(withLocaleCookie(NextResponse.next(), action.locale), request);
    }

    return withAmbassadorRefCookie(NextResponse.next(), request);
}

export const config = {
    matcher: [
        '/',
        '/i/:path*',
        '/g/:path*',
        '/:locale(en|he|ru|ar|fr|es|de)',
        '/:locale(en|he|ru|ar|fr|es|de)/split-calculator',
        '/:locale(en|he|ru|ar|fr|es|de)/splitwise-alternative',
        '/:locale(en|he|ru|ar|fr|es|de)/ambassadors',
        '/:locale(en|he|ru|ar|fr|es|de)/guides',
        '/:locale(en|he|ru|ar|fr|es|de)/guides/:guideSlug',
        '/:locale(en|he|ru|ar|fr|es|de)/:slug(trip-expenses|roommate-bills|event-expenses|couple-expenses)',
    ],
};
