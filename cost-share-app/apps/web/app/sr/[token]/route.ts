// Settle-up reminder landing: https://kupa-pay.com/sr/<token>
// Serves the interstitial page (see app/_lib/inviteLandingHtml.ts) as real
// text/html so the app-open script runs. Mirrors i/[token] and g/[token].
import { inviteLandingHtml } from '@/app/_lib/inviteLandingHtml';

// The body is identical for every token; the per-invite work happens in the
// browser. Render dynamically (the [token] segment cannot be pre-generated).
export const dynamic = 'force-dynamic';

export function GET(): Response {
    return new Response(inviteLandingHtml(), {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
        },
    });
}
