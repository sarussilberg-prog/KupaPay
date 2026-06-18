import { NextRequest, NextResponse } from 'next/server';

const SUPPORTED = ['he', 'en'];

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const locale = formData.get('locale');

  // Redirect back to the same page (same-origin only for safety)
  const referer = request.headers.get('referer') ?? '/';
  let redirectPath = '/';
  try {
    const refererUrl = new URL(referer);
    if (refererUrl.origin === new URL(request.url).origin) {
      redirectPath = refererUrl.pathname + refererUrl.search;
    }
  } catch {
    // Invalid referer — fall back to /
  }

  const response = NextResponse.redirect(new URL(redirectPath, request.url));

  if (typeof locale === 'string' && SUPPORTED.includes(locale)) {
    response.cookies.set('locale', locale, {
      path: '/',
      maxAge: 365 * 24 * 60 * 60,
      sameSite: 'lax',
    });
  }

  return response;
}
