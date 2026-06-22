// Where the marketing site's "Login" CTAs send users.
//
// The web *app* (the Expo web build — login + the full product) is deployed
// separately (e.g. https://kupa-app-dev.vercel.app, https://app.kupa-pay.com).
// Set NEXT_PUBLIC_APP_URL on each marketing deployment to point its Login
// button at the matching app origin. When unset, we fall back to the local
// /login page so nothing breaks in dev or preview.
const APP_WEB_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');

export const LOGIN_HREF = APP_WEB_URL || '/login';
