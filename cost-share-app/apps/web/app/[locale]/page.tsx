import { notFound } from 'next/navigation';
import { isLanguage, SUPPORTED_LANGUAGES } from '@cost-share/shared';
import LandingPage from '../_components/LandingPage';
import { buildLandingPageMetadata } from '@/lib/landingMetadata';
import type { Language } from '@/lib/i18n';

type PageProps = Readonly<{
    params: Promise<{ locale: string }>;
}>;

/** ISR: marketing landings revalidate every 5 minutes (CDN-friendly). */
export const revalidate = 300;

export function generateStaticParams() {
    return SUPPORTED_LANGUAGES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PageProps) {
    const { locale: raw } = await params;
    if (!isLanguage(raw)) {
        return {};
    }
    return buildLandingPageMetadata(raw);
}

export default async function LocaleMarketingPage({ params }: PageProps) {
    const { locale: raw } = await params;
    if (!isLanguage(raw)) {
        notFound();
    }
    return <LandingPage locale={raw as Language} />;
}
