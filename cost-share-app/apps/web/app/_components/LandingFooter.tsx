import Link from 'next/link';
import { APP_VERSION } from '@cost-share/shared';
import type { Translations, Language } from '@/lib/i18n';

interface Props {
  t: Translations;
  locale: Language;
}

export default function LandingFooter({ t, locale }: Props) {
  const otherLocale = locale === 'he' ? 'en' : 'he';

  return (
    <footer className="bg-gray-50 border-t border-gray-100 py-12 px-4">
      <div className="max-w-5xl mx-auto flex flex-col items-center gap-5 text-sm text-gray-500">
        <nav className="flex flex-wrap justify-center gap-6">
          <Link href="/privacy" className="hover:text-gray-800 transition-colors">
            {t.footer.privacy}
          </Link>
          <Link href="/terms" className="hover:text-gray-800 transition-colors">
            {t.footer.terms}
          </Link>
          <Link href="/support" className="hover:text-gray-800 transition-colors">
            {t.footer.contact}
          </Link>
        </nav>
        <div className="flex items-center gap-5">
          <form action="/api/locale" method="POST">
            <input type="hidden" name="locale" value={otherLocale} />
            <button
              type="submit"
              className="text-gray-400 hover:text-gray-700 transition-colors underline underline-offset-2"
            >
              {t.locale.toggle}
            </button>
          </form>
          <span>
            {t.footer.copyright} · v{APP_VERSION}
          </span>
        </div>
      </div>
    </footer>
  );
}
