import type { Translations } from '@/lib/i18n';
import StoreDownloadBadges from './StoreDownloadBadges';

interface Props {
  t: Translations;
}

export default function HeroSection({ t }: Props) {
  return (
    <section className="bg-gradient-to-b from-white to-blue-50 pt-24 pb-32 px-4 text-center">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight mb-6 tracking-tight">
          {t.hero.headline}
        </h1>
        <p className="text-lg sm:text-xl text-gray-500 mb-12 max-w-xl mx-auto leading-relaxed">
          {t.hero.subheadline}
        </p>
        <StoreDownloadBadges t={t} />
      </div>
    </section>
  );
}
