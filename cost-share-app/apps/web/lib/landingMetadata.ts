import type { Metadata } from 'next';
import { APP_WEB_ORIGIN } from '@cost-share/shared';
import { APP_BRAND_TITLE } from '@/lib/brand';
import { getTranslations, type Language } from '@/lib/i18n';
import {
    APP_STORE_URL,
    buildLandingAlternateLanguages,
    marketingLandingUrl,
    PLAY_STORE_URL,
} from '@/lib/marketingSeo';

export function buildLandingPageMetadata(locale: Language): Metadata {
    const t = getTranslations(locale);
    const canonical = marketingLandingUrl(locale);
    const title = t.seo.title;
    const description = t.seo.description;

    return {
        title,
        description,
        alternates: {
            canonical,
            languages: buildLandingAlternateLanguages(),
        },
        openGraph: {
            type: 'website',
            locale,
            url: canonical,
            siteName: APP_BRAND_TITLE,
            title: t.seo.ogTitle,
            description: t.seo.ogDescription,
            images: [{ url: `${APP_WEB_ORIGIN}/icon-512.png`, width: 512, height: 512 }],
        },
        twitter: {
            card: 'summary_large_image',
            title: t.seo.ogTitle,
            description: t.seo.ogDescription,
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
