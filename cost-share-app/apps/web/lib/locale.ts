import { cookies, headers } from 'next/headers';
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, isLanguage, type Language } from '@cost-share/shared';

const LOCALE_COOKIE = 'locale';
const SUPPORTED: Language[] = [...SUPPORTED_LANGUAGES];
const DEFAULT: Language = DEFAULT_LANGUAGE;

// Normalize a raw value (cookie, query param, header tag) to a supported
// Language, or null if it isn't one. Accepts region subtags like 'he-IL'.
function normalizeLang(value: string | null | undefined): Language | null {
  if (!value) return null;
  const lang = value.split('-')[0].trim().toLowerCase();
  return isLanguage(lang) ? lang : null;
}

function parseAcceptLanguage(header: string | null): Language {
  if (!header) return DEFAULT;
  const tags = header.split(',').map((s) => s.split(';')[0]);
  for (const tag of tags) {
    const lang = normalizeLang(tag);
    if (lang) return lang;
  }
  return DEFAULT;
}

// `override` lets callers force the locale explicitly (e.g. a `?lang=` query
// param on deep links from the native app) ahead of the cookie/header.
export async function getLocale(override?: string | null): Promise<Language> {
  const fromOverride = normalizeLang(override);
  if (fromOverride) return fromOverride;

  const cookieStore = await cookies();
  const fromCookie = normalizeLang(cookieStore.get(LOCALE_COOKIE)?.value);
  if (fromCookie) return fromCookie;

  const headerStore = await headers();
  return parseAcceptLanguage(headerStore.get('accept-language'));
}
