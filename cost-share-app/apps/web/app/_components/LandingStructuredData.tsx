import { APP_MARKETING_VERSION, APP_WEB_ORIGIN } from '@cost-share/shared';
import { APP_BRAND_TITLE } from '@/lib/brand';
import type { Translations } from '@/lib/i18n';
import { APP_STORE_URL, PLAY_STORE_URL } from '@/lib/marketingSeo';

type Props = Readonly<{
    t: Translations;
    locale: string;
    pageUrl: string;
}>;

export default function LandingStructuredData({ t, locale, pageUrl }: Props) {
    const payload = {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: APP_BRAND_TITLE,
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'iOS, Android, Web',
        inLanguage: locale,
        url: pageUrl,
        description: t.seo.description,
        softwareVersion: APP_MARKETING_VERSION,
        offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
        },
        downloadUrl: [APP_STORE_URL, PLAY_STORE_URL],
        image: `${APP_WEB_ORIGIN}/icon-512.png`,
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
        />
    );
}
