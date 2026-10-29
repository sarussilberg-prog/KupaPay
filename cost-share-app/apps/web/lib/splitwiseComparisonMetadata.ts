import type { Metadata } from 'next';
import { APP_WEB_ORIGIN } from '@cost-share/shared';
import { APP_BRAND_TITLE } from '@/lib/brand';
import { getTranslations, type Language } from '@/lib/i18n';
import {
    APP_STORE_URL,
    buildSplitwiseComparisonAlternateLanguages,
    PLAY_STORE_URL,
    splitwiseComparisonUrl,
} from '@/lib/marketingSeo';

export function buildSplitwiseComparisonPageMetadata(locale: Language): Metadata {
    const t = getTranslations(locale);
    const page = t.splitwiseComparison;
    const canonical = splitwiseComparisonUrl(locale);

    return {
        title: page.seo.title,
        description: page.seo.description,
        alternates: {
            canonical,
            languages: buildSplitwiseComparisonAlternateLanguages(),
        },
        openGraph: {
            type: 'website',
            locale,
            url: canonical,
            siteName: APP_BRAND_TITLE,
            title: page.seo.ogTitle,
            description: page.seo.ogDescription,
            images: [{ url: `${APP_WEB_ORIGIN}/icon-512.png`, width: 512, height: 512 }],
        },
        twitter: {
            card: 'summary_large_image',
            title: page.seo.ogTitle,
            description: page.seo.ogDescription,
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
