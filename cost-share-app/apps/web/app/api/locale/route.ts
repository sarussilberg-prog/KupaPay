import { NextRequest, NextResponse } from 'next/server';

import { isLanguage, SUPPORTED_LANGUAGES, type Language } from '@cost-share/shared';
import { marketingLandingPath, replaceLocaleInMarketingPath } from '@/lib/marketingSeo';

const LOCALE_SEGMENT = new RegExp(
  `^/(${SUPPORTED_LANGUAGES.join('|')})/?$`,
);

function resolveLocaleRedirectPath(
  refererUrl: URL,
  requestUrl: URL,
  locale: unknown,
): string {
  if (refererUrl.origin !== requestUrl.origin) {
    return typeof locale === 'string' && isLanguage(locale) ? marketingLandingPath(locale) : '/en';
  }

  const pathname = refererUrl.pathname;
  const suffix = refererUrl.search + refererUrl.hash;

  if (pathname === '/' || LOCALE_SEGMENT.test(pathname)) {
    return typeof locale === 'string' && isLanguage(locale)
      ? marketingLandingPath(locale)
      : '/en';
  }

  if (typeof locale === 'string' && isLanguage(locale)) {
    const swapped = replaceLocaleInMarketingPath(pathname, locale);
    if (swapped) {
      return swapped + suffix;
    }
  }

  return pathname + suffix;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const locale = formData.get('locale');

  const referer = request.headers.get('referer') ?? '/';
  let redirectPath = '/en';
  try {
    const refererUrl = new URL(referer);
    redirectPath = resolveLocaleRedirectPath(refererUrl, new URL(request.url), locale);
  } catch {
    redirectPath =
      typeof locale === 'string' && isLanguage(locale)
        ? marketingLandingPath(locale as Language)
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
