import { getTranslations, type Language } from '@/lib/i18n';
import { buildMarketingLandingPageMetadata } from '@/lib/marketingPageMetadata';
import { buildUseCaseAlternateLanguages, useCaseUrl } from '@/lib/marketingSeo';
import type { UseCaseId } from '@/lib/useCasePages';

export function buildUseCasePageMetadata(locale: Language, useCaseId: UseCaseId) {
    const t = getTranslations(locale);
    const page = t.useCases[useCaseId];
    const canonical = useCaseUrl(locale, useCaseId);

    return buildMarketingLandingPageMetadata(
        locale,
        page.seo,
        canonical,
        buildUseCaseAlternateLanguages(useCaseId),
    );
}
