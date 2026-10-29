import type { Metadata } from 'next';
import { APP_WEB_ORIGIN } from '@cost-share/shared';
import { APP_BRAND_TITLE } from '@/lib/brand';
import type { Language } from '@/lib/i18n';
import { APP_STORE_URL, PLAY_STORE_URL } from '@/lib/marketingSeo';

type MarketingSeoFields = Readonly<{
    title: string;
    description: string;
    ogTitle: string;
    ogDescription: string;
}>;

export function buildMarketingLandingPageMetadata(
    locale: Language,
    seo: MarketingSeoFields,
    canonical: string,
    languages: Record<string, string>,
): Metadata {
    return {
        title: seo.title,
        description: seo.description,
        alternates: {
            canonical,
            languages,
        },
        openGraph: {
            type: 'website',
            locale,
            url: canonical,
            siteName: APP_BRAND_TITLE,
            title: seo.ogTitle,
            description: seo.ogDescription,
            images: [{ url: `${APP_WEB_ORIGIN}/icon-512.png`, width: 512, height: 512 }],
        },
        twitter: {
            card: 'summary_large_image',
            title: seo.ogTitle,
            description: seo.ogDescription,
        },
        appLinks: {
            ios: { url: APP_STORE_URL, app_store_id: '6780216665' },
            android: {
                package: 'com.kupapay.mobile',
                url: PLAY_STORE_URL,
            },
        },
        robots: { index: true, follow: true },
    };
}
