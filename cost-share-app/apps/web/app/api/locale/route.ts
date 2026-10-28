import { NextRequest, NextResponse } from 'next/server';

import { isLanguage, SUPPORTED_LANGUAGES } from '@cost-share/shared';
import { marketingLandingPath, replaceLocaleInMarketingPath } from '@/lib/marketingSeo';

const LOCALE_SEGMENT = new RegExp(
  `^/(${SUPPORTED_LANGUAGES.join('|')})/?$`,
);

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const locale = formData.get('locale');

  const referer = request.headers.get('referer') ?? '/';
  let redirectPath = '/en';
  try {
    const refererUrl = new URL(referer);
    if (refererUrl.origin === new URL(request.url).origin) {
      const pathname = refererUrl.pathname;
      if (pathname === '/' || LOCALE_SEGMENT.test(pathname)) {
        redirectPath =
          typeof locale === 'string' && isLanguage(locale)
            ? marketingLandingPath(locale)
            : '/en';
      } else if (
        typeof locale === 'string' &&
        isLanguage(locale) &&
        replaceLocaleInMarketingPath(pathname, locale)
      ) {
        redirectPath =
          replaceLocaleInMarketingPath(pathname, locale)! + refererUrl.search + refererUrl.hash;
      } else {
        redirectPath = pathname + refererUrl.search + refererUrl.hash;
      }
    }
  } catch {
    redirectPath =
      typeof locale === 'string' && isLanguage(locale)
        ? marketingLandingPath(locale)
        : '/en';
  }

  const response = NextResponse.redirect(new URL(redirectPath, request.url));

  if (typeof locale === 'string' && isLanguage(locale)) {
    response.cookies.set('locale', locale, {
      path: '/',
      maxAge: 365 * 24 * 60 * 60,
      sameSite: 'lax',
    });
  }

  return response;
}
