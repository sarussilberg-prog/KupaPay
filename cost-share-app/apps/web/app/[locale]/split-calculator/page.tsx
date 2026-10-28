import { notFound } from 'next/navigation';
import { isLanguage, SUPPORTED_LANGUAGES } from '@cost-share/shared';
import LandingHeader from '../../_components/LandingHeader';
import LandingFooter from '../../_components/LandingFooter';
import SplitCalculatorTool from '../../_components/SplitCalculatorTool';
import { buildSplitCalculatorPageMetadata } from '@/lib/splitCalculatorMetadata';
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
    return buildSplitCalculatorPageMetadata(raw);
}

export default async function SplitCalculatorPage({ params }: PageProps) {
    const { locale: raw } = await params;
    if (!isLanguage(raw)) {
        notFound();
    }
    const locale = raw as Language;
    const t = getTranslations(locale);

    return (
        <>
            <LandingHeader locale={locale} />
            <main id="main-content">
                <SplitCalculatorTool locale={locale} t={t} />
            </main>
            <LandingFooter t={t} locale={locale} />
        </>
    );
}
