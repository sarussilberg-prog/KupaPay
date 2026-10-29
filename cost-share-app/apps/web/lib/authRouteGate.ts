/** Paths that must stay reachable without a Supabase session (Expo web app behind proxy). */
export const AUTH_PUBLIC_PATH_PREFIXES = ['/login', '/auth/callback'] as const;

export type AuthRouteGateAction =
    | { kind: 'allow' }
    | { kind: 'redirect_authenticated_from_login'; destinationPath: '/' }
    | { kind: 'redirect_to_login'; loginPath: '/login'; returnPath: string };

function isPublicAuthPath(pathname: string): boolean {
    return AUTH_PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Pure auth gate for protected app routes (see middleware.next.ts.bak — not yet wired in Next middleware).
 */
export function resolveAuthRouteGate(pathname: string, hasUser: boolean): AuthRouteGateAction {
    if (pathname.startsWith('/login') && hasUser) {
        return { kind: 'redirect_authenticated_from_login', destinationPath: '/' };
    }

    if (isPublicAuthPath(pathname)) {
        return { kind: 'allow' };
    }

    if (!hasUser) {
        return { kind: 'redirect_to_login', loginPath: '/login', returnPath: pathname };
    }

    return { kind: 'allow' };
}
