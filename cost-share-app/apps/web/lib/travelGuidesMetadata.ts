import { getTranslations, type Language } from '@/lib/i18n';
import { buildMarketingLandingPageMetadata } from '@/lib/marketingPageMetadata';
import {
    buildTravelGuideAlternateLanguages,
    buildTravelGuidesIndexAlternateLanguages,
    travelGuideUrl,
    travelGuidesIndexUrl,
} from '@/lib/marketingSeo';
import type { TravelGuideId } from '@/lib/travelGuidesPages';

export function buildTravelGuidesIndexMetadata(locale: Language) {
    const t = getTranslations(locale);
    const page = t.travelGuides.index;
    const canonical = travelGuidesIndexUrl(locale);

    return buildMarketingLandingPageMetadata(
        locale,
        page.seo,
        canonical,
        buildTravelGuidesIndexAlternateLanguages(),
    );
}

export function buildTravelGuidePageMetadata(locale: Language, guideId: TravelGuideId) {
    const t = getTranslations(locale);
    const page = t.travelGuides.guides[guideId];
    const canonical = travelGuideUrl(locale, guideId);

    return buildMarketingLandingPageMetadata(
        locale,
        page.seo,
        canonical,
        buildTravelGuideAlternateLanguages(guideId),
    );
}
