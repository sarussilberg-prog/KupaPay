import type { MetadataRoute } from 'next';
import { APP_WEB_ORIGIN, SUPPORTED_LANGUAGES } from '@cost-share/shared';
import { marketingLandingPath } from '@/lib/marketingSeo';

export default function sitemap(): MetadataRoute.Sitemap {
    const lastModified = new Date();
    const locales = SUPPORTED_LANGUAGES.map((locale) => ({
        url: `${APP_WEB_ORIGIN}${marketingLandingPath(locale)}`,
        lastModified,
        changeFrequency: 'weekly' as const,
        priority: locale === 'en' ? 1 : 0.9,
    }));

    return [
        ...locales,
        {
            url: `${APP_WEB_ORIGIN}/privacy`,
            lastModified,
            changeFrequency: 'monthly',
            priority: 0.5,
        },
        {
            url: `${APP_WEB_ORIGIN}/terms`,
            lastModified,
            changeFrequency: 'monthly',
            priority: 0.5,
        },
        {
            url: `${APP_WEB_ORIGIN}/support`,
            lastModified,
            changeFrequency: 'monthly',
            priority: 0.5,
        },
    ];
}
