import { notFound } from 'next/navigation';
import { isLanguage, SUPPORTED_LANGUAGES } from '@cost-share/shared';
import TravelGuideArticleLanding from '../../../_components/TravelGuideArticleLanding';
import { getTranslations, type Language } from '@/lib/i18n';
import { buildTravelGuidePageMetadata } from '@/lib/travelGuidesMetadata';
import {
    TRAVEL_GUIDE_IDS,
    TRAVEL_GUIDE_SLUG_LIST,
    isTravelGuideSlug,
    travelGuideIdFromSlug,
} from '@/lib/travelGuidesPages';

type PageProps = Readonly<{
    params: Promise<{ locale: string; guideSlug: string }>;
}>;

export const revalidate = 300;

export function generateStaticParams() {
    const params: { locale: string; guideSlug: string }[] = [];
    for (const locale of SUPPORTED_LANGUAGES) {
        for (const guideSlug of TRAVEL_GUIDE_SLUG_LIST) {
            params.push({ locale, guideSlug });
        }
    }
    return params;
}

export async function generateMetadata({ params }: PageProps) {
    const { locale: raw, guideSlug } = await params;
    if (!isLanguage(raw) || !isTravelGuideSlug(guideSlug)) {
        return {};
    }
    const guideId = travelGuideIdFromSlug(guideSlug);
    if (!guideId) {
        return {};
    }
    return buildTravelGuidePageMetadata(raw, guideId);
}

export default async function TravelGuidePage({ params }: PageProps) {
    const { locale: raw, guideSlug } = await params;
    if (!isLanguage(raw) || !isTravelGuideSlug(guideSlug)) {
        notFound();
    }
    const guideId = travelGuideIdFromSlug(guideSlug);
    if (!guideId || !TRAVEL_GUIDE_IDS.includes(guideId)) {
        notFound();
    }
    const locale = raw as Language;
    const t = getTranslations(locale);

    return <TravelGuideArticleLanding locale={locale} guideId={guideId} t={t} />;
}
