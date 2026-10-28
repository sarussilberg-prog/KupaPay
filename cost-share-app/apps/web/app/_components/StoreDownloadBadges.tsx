import React from 'react';
import type { Translations } from '@/lib/i18n';
import { APP_STORE_URL, PLAY_STORE_URL } from '@/lib/marketingSeo';

type Props = Readonly<{
    t: Translations;
}>;

function AppleBadgeIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.42.07 2.4.8 3.22.8.82 0 2.34-.99 3.95-.84 1.03.07 2.64.44 3.6 1.77-3.3 2.02-2.78 6.4.23 7.94-.77 1.5-1.24 2.31-3 3.21zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
        </svg>
    );
}

function PlayBadgeIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3.18 23.76c.3.17.64.22.98.15l11.65-11.65L12.17 8.6 3.18 23.76zM20.5 10.61l-2.89-1.66-3.43 3.43 3.43 3.43 2.91-1.67c.83-.48.83-1.56-.02-2.53zM2.01 1.46C1.69 1.83 1.5 2.37 1.5 3.06v17.88c0 .69.19 1.23.51 1.6l.09.08 10.02-10.02v-.23L2.1 1.38l-.09.08zM12.17 12.6l3.6-3.6-10.5-6.04 6.9 9.64z" />
        </svg>
    );
}

export default function StoreDownloadBadges({ t }: Props) {
    return (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 flex-wrap">
            <a
                href={APP_STORE_URL}
                rel="noopener noreferrer"
                className="inline-flex min-h-[48px] min-w-[200px] items-center gap-3 rounded-xl bg-gray-900 px-5 py-3 text-white shadow-md transition-colors hover:bg-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                aria-label={t.seo.appStoreBadgeAria}
            >
                <AppleBadgeIcon />
                <span className="flex flex-col items-start leading-tight">
                    <span className="text-[10px] uppercase tracking-wide opacity-80">
                        {t.seo.appStoreBadgeTop}
                    </span>
                    <span className="text-sm font-semibold">{t.seo.appStoreBadgeBottom}</span>
                </span>
            </a>

            <a
                href={PLAY_STORE_URL}
                rel="noopener noreferrer"
                className="inline-flex min-h-[48px] min-w-[200px] items-center gap-3 rounded-xl bg-gray-900 px-5 py-3 text-white shadow-md transition-colors hover:bg-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                aria-label={t.seo.playStoreBadgeAria}
            >
                <PlayBadgeIcon />
                <span className="flex flex-col items-start leading-tight">
                    <span className="text-[10px] uppercase tracking-wide opacity-80">
                        {t.seo.playStoreBadgeTop}
                    </span>
                    <span className="text-sm font-semibold">{t.seo.playStoreBadgeBottom}</span>
                </span>
            </a>

            <a
                href="/login"
                className="min-h-[48px] rounded-full border-2 border-blue-500 px-7 py-3.5 text-base font-semibold text-blue-500 transition-colors hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
                {t.hero.ctaSignIn}
            </a>
        </div>
    );
}
