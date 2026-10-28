import { notFound } from 'next/navigation';
import { isLanguage, SUPPORTED_LANGUAGES } from '@cost-share/shared';
import UseCaseLanding from '../../_components/UseCaseLanding';
import { getTranslations, type Language } from '@/lib/i18n';
import { buildUseCasePageMetadata } from '@/lib/useCaseMetadata';
import {
    USE_CASE_IDS,
    USE_CASE_SLUG_LIST,
    isUseCaseSlug,
    useCaseIdFromSlug,
} from '@/lib/useCasePages';

type PageProps = Readonly<{
    params: Promise<{ locale: string; useCaseSlug: string }>;
}>;

export const revalidate = 300;

export function generateStaticParams() {
    const params: { locale: string; useCaseSlug: string }[] = [];
    for (const locale of SUPPORTED_LANGUAGES) {
        for (const useCaseSlug of USE_CASE_SLUG_LIST) {
            params.push({ locale, useCaseSlug });
        }
    }
    return params;
}

export async function generateMetadata({ params }: PageProps) {
    const { locale: raw, useCaseSlug } = await params;
    if (!isLanguage(raw) || !isUseCaseSlug(useCaseSlug)) {
        return {};
    }
    const useCaseId = useCaseIdFromSlug(useCaseSlug);
    if (!useCaseId) {
        return {};
    }
    return buildUseCasePageMetadata(raw, useCaseId);
}

export default async function UseCaseMarketingPage({ params }: PageProps) {
    const { locale: raw, useCaseSlug } = await params;
    if (!isLanguage(raw) || !isUseCaseSlug(useCaseSlug)) {
        notFound();
    }
    const useCaseId = useCaseIdFromSlug(useCaseSlug);
    if (!useCaseId || !USE_CASE_IDS.includes(useCaseId)) {
        notFound();
    }
    const locale = raw as Language;
    const t = getTranslations(locale);

    return <UseCaseLanding locale={locale} useCaseId={useCaseId} t={t} />;
}
