import { notFound } from 'next/navigation';
import { isLanguage, SUPPORTED_LANGUAGES } from '@cost-share/shared';
import TravelGuidesIndexLanding from '../../_components/TravelGuidesIndexLanding';
import { buildTravelGuidesIndexMetadata } from '@/lib/travelGuidesMetadata';
import { getTranslations, type Language } from '@/lib/i18n';

type PageProps = Readonly<{
    params: Promise<{ locale: string }>;
}>;

export const revalidate = 300;

export function generateStaticParams() {
    return SUPPORTED_LANGUAGES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PageProps) {
    const { locale: raw } = await params;
    if (!isLanguage(raw)) {
        return {};
    }
    return buildTravelGuidesIndexMetadata(raw);
}

export default async function TravelGuidesIndexPage({ params }: PageProps) {
    const { locale: raw } = await params;
    if (!isLanguage(raw)) {
        notFound();
    }
    const locale = raw as Language;
    const t = getTranslations(locale);

    return <TravelGuidesIndexLanding locale={locale} t={t} />;
}
