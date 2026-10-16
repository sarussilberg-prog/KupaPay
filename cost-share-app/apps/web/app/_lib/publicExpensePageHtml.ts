import {
    parsePublicExpenseShareWire,
    renderPublicExpenseShareHtml,
    renderPublicExpenseShareNotFoundHtml,
    resolveInviteLandingLocale,
} from '@cost-share/shared';
import { createClient } from '@/utils/supabase/server';

export async function publicExpensePageHtml(
    token: string,
    acceptLanguage: string | null | undefined,
    queryLang: string | null | undefined,
    pathname: string,
): Promise<string> {
    const locale = resolveInviteLandingLocale(acceptLanguage, queryLang);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_public_expense_share_page', {
        p_token: token,
    });

    if (error) {
        return renderPublicExpenseShareNotFoundHtml(locale);
    }

    const wire = parsePublicExpenseShareWire(data);
    if (!wire.ok) {
        return renderPublicExpenseShareNotFoundHtml(locale);
    }

    return renderPublicExpenseShareHtml({
        locale,
        token,
        wire,
        canonicalPath: pathname,
    });
}
