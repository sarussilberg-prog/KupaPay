import {
    parsePublicGroupWebViewPayload,
    renderPublicGroupWebHtml,
    resolveInviteLandingLocale,
    type Language,
    type PublicGroupWebViewPayload,
} from '@cost-share/shared';
import { createClient } from '@/utils/supabase/server';
import { inviteLandingHtml } from '@/app/_lib/inviteLandingHtml';

export async function publicGroupWebPageHtml(
    acceptLanguage: string | null | undefined,
    queryLang: string | null | undefined,
    pathname: string,
    token: string,
): Promise<string> {
    const locale: Language = resolveInviteLandingLocale(acceptLanguage, queryLang);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_public_group_web_view', { p_token: token });

    if (error) {
        return inviteLandingHtml(acceptLanguage, queryLang, pathname);
    }

    const payload: PublicGroupWebViewPayload = parsePublicGroupWebViewPayload(data);
    if (payload.kind !== 'ok') {
        return inviteLandingHtml(acceptLanguage, queryLang, pathname);
    }

    return renderPublicGroupWebHtml({ locale, token, payload });
}
