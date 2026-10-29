import { getTranslations, type Language } from '@/lib/i18n';
import { buildMarketingLandingPageMetadata } from '@/lib/marketingPageMetadata';
import {
    ambassadorProgramUrl,
    buildAmbassadorProgramAlternateLanguages,
} from '@/lib/marketingSeo';

export function buildAmbassadorProgramPageMetadata(locale: Language) {
    const t = getTranslations(locale);
    const page = t.ambassadorProgram;
    return buildMarketingLandingPageMetadata(
        locale,
        page.seo,
        ambassadorProgramUrl(locale),
        buildAmbassadorProgramAlternateLanguages(),
    );
}
