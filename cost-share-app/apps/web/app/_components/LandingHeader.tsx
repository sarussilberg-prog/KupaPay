import Image from 'next/image';
import Link from 'next/link';
import { getTranslations, type Language } from '@/lib/i18n';
import { marketingLandingPath } from '@/lib/marketingSeo';
import { APP_BRAND_TITLE } from '@/lib/brand';
import LanguagePicker from './LanguagePicker';

type Props = Readonly<{
  locale: Language;
}>;

export default function LandingHeader({ locale }: Props) {
  const t = getTranslations(locale);
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href={marketingLandingPath(locale)} className="flex items-center gap-2 shrink-0">
          <Image
            src="/icon.png"
            alt={APP_BRAND_TITLE}
            width={32}
            height={32}
            priority
          />
          <span className="text-lg font-bold text-blue-500">{APP_BRAND_TITLE}</span>
        </Link>

        <div className="flex items-center gap-3">
          <LanguagePicker current={locale} label={t.locale.chooseLanguage} />
        </div>
      </div>
    </header>
  );
}
