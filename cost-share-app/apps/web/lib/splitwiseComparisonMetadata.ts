import { getTranslations, type Language } from '@/lib/i18n';
import { buildMarketingLandingPageMetadata } from '@/lib/marketingPageMetadata';
import {
    buildSplitwiseComparisonAlternateLanguages,
    splitwiseComparisonUrl,
} from '@/lib/marketingSeo';

export function buildSplitwiseComparisonPageMetadata(locale: Language) {
    const t = getTranslations(locale);
    const page = t.splitwiseComparison;
    const canonical = splitwiseComparisonUrl(locale);

    return buildMarketingLandingPageMetadata(
        locale,
        page.seo,
        canonical,
        buildSplitwiseComparisonAlternateLanguages(),
    );
}
