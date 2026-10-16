// Friend invite landing: https://kupa-pay.com/i/<token>
import { inviteLandingHtml } from '@/app/_lib/inviteLandingHtml';

export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const html = inviteLandingHtml(
        req.headers.get('accept-language'),
        url.searchParams.get('lang'),
        url.pathname,
    );
    return new Response(html, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
        },
    });
}
