// Edge Function: invite-landing
// Serves /.well-known/* (AASA / assetlinks), legal pages, account-deletion, and
// bounces invite links (/i/<token>, /g/<token>) to the marketing site.
// See docs/superpowers/specs/2026-05-20-invites-and-sharing-design.md

import { createClient } from 'supabase';
import { handleWellKnown } from './well-known.ts';
import { handleAccountDeletion, handleLegal } from './legal.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const MARKETING_SITE = 'https://kupa-pay.com/';

Deno.serve(async (req: Request) => {
    const url = new URL(req.url);
    // Supabase serves this function at /functions/v1/invite-landing/*; strip that prefix
    // when present so the same routes work both behind kupa-pay.com and the direct project URL.
    const path = url.pathname.replace(/^\/functions\/v1\/invite-landing/, '').replace(/^\/invite-landing/, '') || '/';

    // well-known files (AASA / assetlinks) — served as application/json, which the
    // Supabase gateway preserves. These power OS-level Universal Links / App Links.
    const wk = handleWellKnown(path);
    if (wk) return wk;

    // legal pages (privacy / terms) — content from legal_documents table
    const legal = await handleLegal(req, path, client);
    if (legal) return legal;

    // account deletion instructions (required by Google Play Data safety)
    const deletion = handleAccountDeletion(req, path);
    if (deletion) return deletion;

    // Invite links (/i/<token> friend, /g/<token> group, /sr/<token> settle reminder).
    // When a user TAPS one of these from another app with KupaPay installed, iOS
    // Universal Links / Android App Links open the app at the OS level and this
    // function is never reached. We only land here in a browser (app not installed,
    // or the URL was pasted into the address bar). The Supabase gateway refuses to
    // serve HTML from *.supabase.co (it downgrades text/html to text/plain), so we
    // cannot render a landing page or run JS here. A 302 is content-type independent
    // and survives both the gateway and the Vercel proxy, so we bounce the browser
    // to the marketing site, which owns the "no app installed" story.
    if (/^\/(i|g|sr)\//.test(path)) {
        return redirectToSite();
    }

    // root
    if (path === '/' || path === '') {
        return redirectToSite();
    }

    return new Response('Not found', { status: 404 });
});

// 302 (temporary) on purpose: never 301/308, which browsers cache hard and would
// pin this behavior. Location points at a hardcoded constant (no open-redirect).
function redirectToSite(): Response {
    return new Response(null, {
        status: 302,
        headers: {
            Location: MARKETING_SITE,
            'Cache-Control': 'no-store',
        },
    });
}
