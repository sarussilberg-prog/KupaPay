import { SUPPORTED_LANGUAGES } from '@cost-share/shared';

/** Canonical web-app sign-in path (proxied to the Expo web build). */
export const WEB_APP_LOGIN_PATH = '/login';

/** App paths served via APP_PROXY fallback (not Next.js marketing pages). */
export const WEB_APP_ENTRY_PATHS = [
    '/login',
    '/sign-in',
    '/app',
    '/home',
    '/auth/callback',
] as const;

const LOCALE_PATTERN = SUPPORTED_LANGUAGES.join('|');

/** Redirect locale-prefixed app entry URLs to the root path the proxy expects. */
export function localePrefixedAppEntryRedirects(): {
    source: string;
    destination: string;
    permanent: boolean;
}[] {
    return WEB_APP_ENTRY_PATHS.flatMap((entryPath) => {
        const trimmed = entryPath.slice(1);
        return [
            {
                source: `/:locale(${LOCALE_PATTERN})/${trimmed}`,
                destination: entryPath,
                permanent: false,
            },
            {
                source: `/:locale(${LOCALE_PATTERN})/${trimmed}/:path*`,
                destination: `${entryPath}/:path*`,
                permanent: false,
            },
        ];
    });
}
