import type { MetadataRoute } from 'next';
import { APP_WEB_ORIGIN, SUPPORTED_LANGUAGES } from '@cost-share/shared';
import { marketingLandingPath, splitCalculatorPath, useCasePath } from '@/lib/marketingSeo';
import { USE_CASE_IDS } from '@/lib/useCasePages';

export default function sitemap(): MetadataRoute.Sitemap {
    const lastModified = new Date();
    const locales = SUPPORTED_LANGUAGES.map((locale) => ({
        url: `${APP_WEB_ORIGIN}${marketingLandingPath(locale)}`,
        lastModified,
        changeFrequency: 'weekly' as const,
        priority: locale === 'en' ? 1 : 0.9,
    }));

    const calculators = SUPPORTED_LANGUAGES.map((locale) => ({
        url: `${APP_WEB_ORIGIN}${splitCalculatorPath(locale)}`,
        lastModified,
        changeFrequency: 'weekly' as const,
        priority: locale === 'en' ? 0.95 : 0.85,
    }));

    const useCasePages = SUPPORTED_LANGUAGES.flatMap((locale) =>
        USE_CASE_IDS.map((id) => ({
            url: `${APP_WEB_ORIGIN}${useCasePath(locale, id)}`,
            lastModified,
            changeFrequency: 'weekly' as const,
            priority: locale === 'en' ? 0.9 : 0.8,
        })),
    );

    return [
        ...locales,
        ...calculators,
        ...useCasePages,
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
