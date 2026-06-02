import * as Sentry from '@sentry/react-native';

export interface IdentityUser {
    id: string;
    email?: string;
    name: string;
    defaultCurrency?: string;
}

/** Apply (or clear) the Sentry user identity. Called from App.tsx on auth changes. */
export function applySentryUser(user: IdentityUser | null): void {
    if (user) {
        Sentry.setUser({ id: user.id, email: user.email, username: user.name });
        Sentry.setTag('default_currency', user.defaultCurrency);
    } else {
        Sentry.setUser(null);
        Sentry.setTag('default_currency', undefined);
    }
}

/** Apply the app's UI language as a Sentry tag. */
export function applySentryLanguage(language: string): void {
    Sentry.setTag('app_language', language);
}
