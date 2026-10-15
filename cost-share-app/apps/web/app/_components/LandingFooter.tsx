import Link from 'next/link';
import { APP_VERSION } from '@cost-share/shared';
import type { Translations, Language } from '@/lib/i18n';
import LanguagePicker from './LanguagePicker';

interface Props {
  t: Translations;
  locale: Language;
}

export default function LandingFooter({ t, locale }: Props) {
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
          <LanguagePicker current={locale} label={t.locale.chooseLanguage} />
          <span>
            {t.footer.copyright} · v{APP_VERSION}
          </span>
        </div>
      </div>
    </footer>
  );
}
