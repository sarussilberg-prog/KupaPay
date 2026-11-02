import { SUPPORTED_LANGUAGES } from '@cost-share/shared';

/** Root marketing pages and invite/public link routes — never proxied to the Expo app. */
const MARKETING_EXACT_PATHS = new Set([
    '/',
    '/privacy',
    '/terms',
    '/support',
    '/settings',
    '/account-deletion',
]);

const MARKETING_PREFIXES = [
    '/api/',
    '/_next/',
    '/email/',
    '/legal/',
    '/.well-known/',
    '/b/',
    '/e/',
    '/g/',
    '/i/',
    '/sr/',
] as const;

const PUBLIC_FILE = /\.(png|jpe?g|gif|webp|svg|ico|txt|xml|json|css|js|woff2?)$/i;

/** Expo web static bundles and app entry paths — must proxy even when the path looks like a public file. */
const APP_OWNED_EXACT = new Set(['/manifest.json', '/favicon.ico']);

const APP_OWNED_PREFIXES = [
    '/_expo/',
    '/assets/',
    '/login/',
    '/sign-in/',
    '/app/',
    '/home/',
    '/group/',
    '/activity/',
    '/auth/',
] as const;

const APP_OWNED_EXACT_PATHS = new Set([
    '/login',
    '/sign-in',
    '/app',
    '/home',
    '/group',
    '/activity',
]);

function isAppOwnedPath(pathname: string): boolean {
    if (APP_OWNED_EXACT.has(pathname) || APP_OWNED_EXACT_PATHS.has(pathname)) {
        return true;
    }
    return APP_OWNED_PREFIXES.some(
        (prefix) => pathname === prefix.slice(0, -1) || pathname.startsWith(prefix),
    );
}

export function isMarketingOwnedPath(pathname: string): boolean {
    if (isAppOwnedPath(pathname)) {
        return false;
    }
    if (MARKETING_EXACT_PATHS.has(pathname)) {
        return true;
    }
    if (PUBLIC_FILE.test(pathname)) {
        return true;
    }
    const firstSegment = pathname.slice(1).split('/')[0];
    if ((SUPPORTED_LANGUAGES as readonly string[]).includes(firstSegment)) {
        return true;
    }
    return MARKETING_PREFIXES.some(
        (prefix) => pathname === prefix.slice(0, -1) || pathname.startsWith(prefix),
    );
}

export function shouldProxyPathToExpoApp(pathname: string): boolean {
    return !isMarketingOwnedPath(pathname);
}

/** beforeFiles rewrites must run before `app/[locale]` captures single-segment app paths. */
export function appProxyBeforeFileRewrites(appProxyOrigin: string): {
    source: string;
    destination: string;
}[] {
    const origin = appProxyOrigin.replace(/\/+$/, '');
    return [
        { source: '/login', destination: `${origin}/login` },
        { source: '/login/:path*', destination: `${origin}/login/:path*` },
        { source: '/sign-in', destination: `${origin}/sign-in` },
        { source: '/sign-in/:path*', destination: `${origin}/sign-in/:path*` },
        { source: '/app', destination: `${origin}/app` },
        { source: '/app/:path*', destination: `${origin}/app/:path*` },
        { source: '/home', destination: `${origin}/home` },
        { source: '/home/:path*', destination: `${origin}/home/:path*` },
        { source: '/group', destination: `${origin}/group` },
        { source: '/group/:path*', destination: `${origin}/group/:path*` },
        { source: '/activity', destination: `${origin}/activity` },
        { source: '/activity/:path*', destination: `${origin}/activity/:path*` },
        { source: '/auth/:path*', destination: `${origin}/auth/:path*` },
        { source: '/_expo/:path*', destination: `${origin}/_expo/:path*` },
        { source: '/assets/:path*', destination: `${origin}/assets/:path*` },
        { source: '/manifest.json', destination: `${origin}/manifest.json` },
        { source: '/favicon.ico', destination: `${origin}/favicon.ico` },
    ];
}
