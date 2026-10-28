import type { Metadata } from 'next';
import { APP_WEB_ORIGIN } from '@cost-share/shared';
import { APP_BRAND_TITLE } from '@/lib/brand';
import { getTranslations, type Language } from '@/lib/i18n';
import {
    APP_STORE_URL,
    buildUseCaseAlternateLanguages,
    PLAY_STORE_URL,
    useCaseUrl,
} from '@/lib/marketingSeo';
import type { UseCaseId } from '@/lib/useCasePages';

export function buildUseCasePageMetadata(locale: Language, useCaseId: UseCaseId): Metadata {
    const t = getTranslations(locale);
    const page = t.useCases[useCaseId];
    const canonical = useCaseUrl(locale, useCaseId);

    return {
        title: page.seo.title,
        description: page.seo.description,
        alternates: {
            canonical,
            languages: buildUseCaseAlternateLanguages(useCaseId),
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
