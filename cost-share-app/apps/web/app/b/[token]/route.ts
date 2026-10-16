// Public group balance page: https://kupa-pay.com/b/<public_balance_token>
import { publicGroupPageHtml } from '@/app/_lib/publicGroupPageHtml';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }): Promise<Response> {
    const { token } = await ctx.params;
    const url = new URL(req.url);
    const html = await publicGroupPageHtml(
        token,
        req.headers.get('accept-language'),
        url.searchParams.get('lang'),
        url.pathname,
    );
    return new Response(html, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Robots-Tag': 'noindex, nofollow',
        },
    });
}
