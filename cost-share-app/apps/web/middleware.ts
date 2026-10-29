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
import { shouldProxyPathToExpoApp } from '@/lib/marketingAppProxy';

const APP_PROXY_ORIGIN = (process.env.APP_PROXY_ORIGIN ?? '').replace(/\/+$/, '');

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

    if (APP_PROXY_ORIGIN && shouldProxyPathToExpoApp(pathname)) {
        const target = new URL(`${pathname}${request.nextUrl.search}`, APP_PROXY_ORIGIN);
        return NextResponse.rewrite(target);
    }

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
        '/((?!_next/static|_next/image|favicon\\.png|icon\\.png|apple-touch-icon\\.png|manifest\\.webmanifest|robots\\.txt|sitemap\\.xml).*)',
    ],
};
