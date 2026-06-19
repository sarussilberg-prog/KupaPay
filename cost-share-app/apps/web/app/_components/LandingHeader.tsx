import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getLocale } from '@/lib/locale';
import { getTranslations } from '@/lib/i18n';
import { APP_BRAND_TITLE } from '@/lib/brand';

async function signOut() {
  'use server';
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}

export default async function LandingHeader() {
  const locale = await getLocale();
  const t = getTranslations(locale);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const displayName = user?.user_metadata?.full_name ?? user?.email ?? '';
  const otherLocale = locale === 'he' ? 'en' : 'he';

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Image src="/icon.png" alt={APP_BRAND_TITLE} width={32} height={32} />
          <span className="text-lg font-bold text-blue-500">{APP_BRAND_TITLE}</span>
        </Link>

        {/* Right side controls */}
        <div className="flex items-center gap-3">
          {/* Language toggle */}
          <form action="/api/locale" method="POST">
            <input type="hidden" name="locale" value={otherLocale} />
            <button
              type="submit"
              className="text-sm text-gray-500 hover:text-gray-800 px-2 py-1 rounded transition-colors"
            >
              {t.locale.toggle}
            </button>
          </form>

          {/* Auth */}
          {user ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 hidden sm:block">
                {t.header.hello}, {displayName}
              </span>
              <form action={signOut}>
                <button
                  type="submit"
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                >
                  {t.header.signOut}
                </button>
              </form>
            </div>
          ) : (
            <Link
              href="/login"
              className="text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-full transition-colors"
            >
              {t.header.signIn}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
