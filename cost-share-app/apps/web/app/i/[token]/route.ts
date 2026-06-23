// Friend invite landing: https://kupa-pay.com/i/<token>
// Serves the interstitial page (see app/_lib/inviteLandingHtml.ts) as real
// text/html so the app-open script runs. Replaces the old vercel.json rewrite
// that proxied this path to the Supabase function (which can only 302).
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
