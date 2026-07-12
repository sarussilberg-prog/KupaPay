import type { NextConfig } from 'next';

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

const nextConfig: NextConfig = {
  transpilePackages: ['@cost-share/shared'],
  async rewrites() {
    if (!APP_PROXY_ORIGIN) return [];
    return {
      fallback: [{ source: '/:path*', destination: `${APP_PROXY_ORIGIN}/:path*` }],
    };
  },
};

export default nextConfig;
