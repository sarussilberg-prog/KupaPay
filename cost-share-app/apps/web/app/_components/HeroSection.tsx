import Link from 'next/link';
import type { Translations } from '@/lib/i18n';

// TODO: Replace with real App Store URL when app is live on the App Store
const APP_STORE_URL = 'https://apps.apple.com/app/kupapay';

// TODO: Replace with real Google Play URL when app is live on Google Play
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.kupapay.mobile';

interface Props {
  t: Translations;
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.42.07 2.4.8 3.22.8.82 0 2.34-.99 3.95-.84 1.03.07 2.64.44 3.6 1.77-3.3 2.02-2.78 6.4.23 7.94-.77 1.5-1.24 2.31-3 3.21zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

function PlayStoreIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3.18 23.76c.3.17.64.22.98.15l11.65-11.65L12.17 8.6 3.18 23.76zM20.5 10.61l-2.89-1.66-3.43 3.43 3.43 3.43 2.91-1.67c.83-.48.83-1.56-.02-2.53zM2.01 1.46C1.69 1.83 1.5 2.37 1.5 3.06v17.88c0 .69.19 1.23.51 1.6l.09.08 10.02-10.02v-.23L2.1 1.38l-.09.08zM12.17 12.6l3.6-3.6-10.5-6.04 6.9 9.64z" />
    </svg>
  );
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
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 flex-wrap">
          {/* App Store */}
          <a
            href={APP_STORE_URL}
            className="flex items-center gap-2 px-7 py-3.5 bg-gray-900 text-white rounded-full font-semibold text-base hover:bg-gray-700 transition-colors shadow-md"
          >
            <AppleIcon />
            {t.hero.ctaDownloadIos}
          </a>

          {/* Google Play */}
          <a
            href={PLAY_STORE_URL}
            className="flex items-center gap-2 px-7 py-3.5 bg-gray-900 text-white rounded-full font-semibold text-base hover:bg-gray-700 transition-colors shadow-md"
          >
            <PlayStoreIcon />
            {t.hero.ctaDownloadAndroid}
          </a>

          {/* Web sign-in */}
          <Link
            href="/login"
            className="px-7 py-3.5 border-2 border-blue-500 text-blue-500 rounded-full font-semibold text-base hover:bg-blue-50 transition-colors"
          >
            {t.hero.ctaSignIn}
          </Link>
        </div>
      </div>
    </section>
  );
}
