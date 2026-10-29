import { notFound } from 'next/navigation';
import { isLanguage, SUPPORTED_LANGUAGES } from '@cost-share/shared';
import SplitwiseComparisonLanding from '../../_components/SplitwiseComparisonLanding';
import { buildSplitwiseComparisonPageMetadata } from '@/lib/splitwiseComparisonMetadata';
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
    return buildSplitwiseComparisonPageMetadata(raw);
}

export default async function SplitwiseAlternativePage({ params }: PageProps) {
    const { locale: raw } = await params;
    if (!isLanguage(raw)) {
        notFound();
    }
    const locale = raw as Language;
    const t = getTranslations(locale);

    return <SplitwiseComparisonLanding locale={locale} t={t} />;
}
