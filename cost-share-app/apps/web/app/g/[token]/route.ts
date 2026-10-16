// Group invite + optional public balance view: https://kupa-pay.com/g/<token>
import { publicGroupWebPageHtml } from '@/app/_lib/publicGroupWebPage';
import { INVITE_TOKEN_RE } from '@cost-share/shared';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }): Promise<Response> {
    const url = new URL(req.url);
    const { token: rawToken } = await ctx.params;
    const token = rawToken && INVITE_TOKEN_RE.test(rawToken) ? rawToken : '';
    const html = await publicGroupWebPageHtml(
        req.headers.get('accept-language'),
        url.searchParams.get('lang'),
        url.pathname,
        token,
    );
    return new Response(html, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
        },
    });
}
