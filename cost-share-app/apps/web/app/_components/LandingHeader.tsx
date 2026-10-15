import Image from 'next/image';
import Link from 'next/link';
import { getLocale } from '@/lib/locale';
import { getTranslations } from '@/lib/i18n';
import { APP_BRAND_TITLE } from '@/lib/brand';
import LanguagePicker from './LanguagePicker';

// The marketing site is identical for everyone — it has no logged-in surface and
// shows no user-specific state. Signing in happens inside the app, which is served
// under this same domain at /login (proxied via the next.config rewrite).
export default async function LandingHeader() {
  const locale = await getLocale();
  const t = getTranslations(locale);
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
          <LanguagePicker current={locale} label={t.locale.chooseLanguage} />
        </div>
      </div>
    </header>
  );
}
