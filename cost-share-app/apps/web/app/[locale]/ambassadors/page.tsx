import { notFound } from 'next/navigation';
import { isLanguage, SUPPORTED_LANGUAGES } from '@cost-share/shared';
import AmbassadorProgramLanding from '../../_components/AmbassadorProgramLanding';
import { buildAmbassadorProgramPageMetadata } from '@/lib/ambassadorProgramMetadata';
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
    return buildAmbassadorProgramPageMetadata(raw);
}

export default async function AmbassadorProgramPage({ params }: PageProps) {
    const { locale: raw } = await params;
    if (!isLanguage(raw)) {
        notFound();
    }
    const locale = raw as Language;
    const t = getTranslations(locale);
    return <AmbassadorProgramLanding locale={locale} t={t} />;
}
