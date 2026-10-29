import type { NextConfig } from 'next';
import bundleAnalyzer from '@next/bundle-analyzer';
import { withSentryConfig } from '@sentry/nextjs/config';
import { sentryReleaseMetadata } from '@cost-share/shared';
import { CONTENT_SECURITY_POLICY } from '../../packages/shared/src/security/contentSecurityPolicy';
import versionJson from '../../packages/shared/version.json';
import { localePrefixedAppEntryRedirects } from './lib/marketingAppRoutes';

const appVersion = (versionJson as { version: string }).version;
const vercelSha = (process.env.VERCEL_GIT_COMMIT_SHA ?? '').trim();
const kupapayEnvLabel =
  process.env.NEXT_PUBLIC_KUPAPAY_ENV ??
  (process.env.VERCEL_ENV === 'production' ? 'production' : 'development');

// The web *app* (the Expo web build — login + the full product) is deployed as a
// separate Vercel project. We proxy it under THIS marketing domain so users only
// ever see kupa-pay.com: the marketing site owns `/` (+ /privacy, /support, /terms,
// /api/*, /_next/*), and every other path (/login, /home, /group, /activity,
// /auth/callback, /_expo/*, /assets/*, …) falls through to the app. Because it's a
// server-side rewrite (not a redirect), the app's origin is never shown in the URL.
//
// Set APP_PROXY_ORIGIN per deployment (dev -> the dev app project, prod -> the prod
// app project). It is intentionally NOT a NEXT_PUBLIC_ var so the internal app URL
// stays out of the client bundle. When unset, no proxy is configured.
const APP_PROXY_ORIGIN = (process.env.APP_PROXY_ORIGIN ?? '').replace(/\/+$/, '');

/** Supabase invite-landing edge base — must follow NEXT_PUBLIC_SUPABASE_URL per deploy (dev vs prod). */
function inviteLandingBase(): string {
  const root = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  if (!root) return '';
  return `${root}/functions/v1/invite-landing`;
}

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
  {
    key: 'Content-Security-Policy',
    value: CONTENT_SECURITY_POLICY,
  },
];

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  transpilePackages: ['@cost-share/shared'],
  // Marketing pages: allow CDN/browser caching between deploys (free-tier friendly).
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 300,
    },
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: vercelSha.slice(0, 7),
    NEXT_PUBLIC_KUPAPAY_ENV: kupapayEnvLabel,
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  async redirects() {
    return localePrefixedAppEntryRedirects();
  },
  async rewrites() {
    const landing = inviteLandingBase();
    const beforeFiles = landing
      ? [
          {
            source: '/.well-known/apple-app-site-association',
            destination: `${landing}/.well-known/apple-app-site-association`,
          },
          {
            source: '/.well-known/assetlinks.json',
            destination: `${landing}/.well-known/assetlinks.json`,
          },
          { source: '/legal/:slug', destination: `${landing}/legal/:slug` },
          { source: '/account-deletion', destination: `${landing}/account-deletion` },
        ]
      : [];

    if (!APP_PROXY_ORIGIN) {
      return beforeFiles.length ? { beforeFiles } : [];
    }

    return {
      beforeFiles,
      fallback: [{ source: '/:path*', destination: `${APP_PROXY_ORIGIN}/:path*` }],
    };
  },
};

const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN?.trim();
const uploadSourceMaps = Boolean(sentryAuthToken);
const { release, dist } = sentryReleaseMetadata({
  slug: 'kupapay-web',
  version: appVersion,
  buildNumber: vercelSha || null,
});

export default withSentryConfig(withBundleAnalyzer(nextConfig), {
  org: process.env.SENTRY_ORG?.trim() || 'kupay-hb',
  project: process.env.SENTRY_PROJECT?.trim() || 'kupapay-web',
  authToken: sentryAuthToken,
  silent: !uploadSourceMaps,
  sourcemaps: {
    disable: !uploadSourceMaps,
  },
  release: uploadSourceMaps
    ? {
        name: release,
        dist,
        create: true,
        finalize: true,
      }
    : {
        create: false,
        finalize: false,
      },
});
