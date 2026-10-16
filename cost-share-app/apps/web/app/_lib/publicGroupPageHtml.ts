import {
    parsePublicGroupBalancePageWire,
    renderPublicGroupNotFoundHtml,
    renderPublicGroupPageHtml,
    resolveInviteLandingLocale,
} from '@cost-share/shared';
import { createClient } from '@/utils/supabase/server';

export async function publicGroupPageHtml(
    token: string,
    acceptLanguage: string | null | undefined,
    queryLang: string | null | undefined,
    pathname: string,
): Promise<string> {
    const locale = resolveInviteLandingLocale(acceptLanguage, queryLang);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_public_group_balance_page', {
        p_token: token,
    });

    if (error) {
        return renderPublicGroupNotFoundHtml(locale);
    }

    const wire = parsePublicGroupBalancePageWire(data);
    if (!wire.ok) {
        return renderPublicGroupNotFoundHtml(locale);
    }

    return renderPublicGroupPageHtml({
        locale,
        token,
        wire,
        canonicalPath: pathname,
    });
}
