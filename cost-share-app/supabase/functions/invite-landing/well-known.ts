// Serves the Universal Links / App Links association files under /.well-known/*.
// Env vars (set on the Supabase project secrets — see Task 24):
//   KUPAPAY_IOS_TEAM_ID (legacy: KUPAY_IOS_TEAM_ID, KUPA_IOS_TEAM_ID) — Apple Developer Team ID
//   KUPAPAY_ANDROID_DEBUG_SHA256 — Android debug keystore SHA-256 (optional, dev builds only)
//
// The Android *release* fingerprint below is NOT read from an env var. The
// `KUPAPAY_ANDROID_RELEASE_SHA256` project secret was found to hold a stale/incorrect
// value (neither of the two fingerprints it produced matched Play Console), which made
// Play Console report the kupa-pay.com domain as "not verified" / App Links as broken
// (2026-07-09). The value below was copied directly from
// Play Console → Setup → App signing → "App signing key certificate" → SHA-256, which is
// the certificate Google actually re-signs the published App Bundle with — the only one
// that matters for Android App Links `autoVerify`. It is public information (it's served
// from this very endpoint), so hardcoding it here is safe. If the app signing key is ever
// rotated in Play Console, update this constant and redeploy.
const PLAY_APP_SIGNING_SHA256 = '5C:CC:5E:26:9D:4D:DA:FB:CC:C3:43:84:26:7E:AF:F6:D5:7A:43:8D:37:A9:3B:67:5A:36:9B:BB:F3:DF:64:C7';

function env(...names: string[]): string {
    for (const n of names) {
        const v = Deno.env.get(n);
        if (v) return v;
    }
    return '';
}

const TEAM_ID = env('KUPAPAY_IOS_TEAM_ID', 'KUPAY_IOS_TEAM_ID', 'KUPA_IOS_TEAM_ID');
const ANDROID_DEBUG_SHA = env('KUPAPAY_ANDROID_DEBUG_SHA256', 'KUPAY_ANDROID_DEBUG_SHA256', 'KUPA_ANDROID_DEBUG_SHA256');
const ANDROID_RELEASE_SHA = PLAY_APP_SIGNING_SHA256;

const AASA_JSON = JSON.stringify({
    applinks: {
        apps: [],
        details: [{
            appID: `${TEAM_ID}.com.kupapay.mobile`,
            paths: ['/i/*', '/g/*', '/sr/*'],
        }],
    },
});

const ANDROID_LINKS_JSON = JSON.stringify([{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
        namespace: 'android_app',
        package_name: 'com.kupapay.mobile',
        sha256_cert_fingerprints: [ANDROID_RELEASE_SHA, ANDROID_DEBUG_SHA].filter(Boolean),
    },
}]);

export function handleWellKnown(path: string): Response | null {
    if (path === '/.well-known/apple-app-site-association') {
        return new Response(AASA_JSON, {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=3600',
            },
        });
    }
    if (path === '/.well-known/assetlinks.json') {
        return new Response(ANDROID_LINKS_JSON, {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=3600',
            },
        });
    }
    return null;
}
