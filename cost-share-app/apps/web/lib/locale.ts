import { cookies, headers } from 'next/headers';
import type { Language } from '@cost-share/shared';

const LOCALE_COOKIE = 'locale';
const SUPPORTED: Language[] = ['he', 'en'];
const DEFAULT: Language = 'he';

function parseAcceptLanguage(header: string | null): Language {
  if (!header) return DEFAULT;
  const tags = header.split(',').map((s) => s.split(';')[0].trim().toLowerCase());
  for (const tag of tags) {
    const lang = tag.split('-')[0] as Language;
    if ((SUPPORTED as string[]).includes(lang)) return lang;
  }
  return DEFAULT;
}

export async function getLocale(): Promise<Language> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value as Language | undefined;
  if (fromCookie && (SUPPORTED as string[]).includes(fromCookie)) return fromCookie;

  const headerStore = await headers();
  return parseAcceptLanguage(headerStore.get('accept-language'));
}
