// Interstitial page served by Next.js for invite links /i/<token> and /g/<token>.
// Rendering logic lives in @cost-share/shared (deferred deep link clipboard + Play referrer).

import {
    renderInviteLandingHtml,
    resolveInviteLandingLocale,
    type Language,
} from '@cost-share/shared';

export function inviteLandingHtml(
    acceptLanguage: string | null | undefined,
    queryLang: string | null | undefined,
    pathname?: string,
): string {
    const locale: Language = resolveInviteLandingLocale(acceptLanguage, queryLang);
    return renderInviteLandingHtml({ locale, pathname });
}
