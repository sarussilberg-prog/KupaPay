import type { KnipConfig } from 'knip';

/**
 * Knip workspace config for dead-code reporting (CI + local).
 * Conservative ignores: Expo config plugins, EAS/ASC scripts, i18n JSON, platform suffixes.
 */
const config: KnipConfig = {
  // Intentional root deps: hoist patched markdown-it/linkify-it for react-native-markdown-display (#590).
  ignoreDependencies: ['markdown-it', 'linkify-it'],
  ignoreFiles: [
    'scripts/**',
    'lighthouserc.cjs',
    'supabase/functions/**/index.ts',
    'supabase/functions/**/cors.ts',
    'supabase/functions/invite-landing/**',
  ],
  ignoreBinaries: ['python3', 'eas'],
  workspaces: {
    '@cost-share/mobile': {
      entry: [
        'index.ts',
        'App.tsx',
        'app.config.ts',
        'jest-setup.ts',
        'navigation/**/*.{ts,tsx}',
        '**/*.{test,spec}.{ts,tsx}',
      ],
      project: ['**/*.{ts,tsx}'],
      ignoreFiles: [
        'scripts/**',
        'plugins/**',
        'dev/**',
        'screenshotDemo/**',
        'babel.config.js',
        'metro.config.js',
        'global.css',
        'i18n/locales/**',
        '**/*.{web,android,ios}.ts',
      ],
      babel: { config: ['babel.config.js'] },
      metro: { config: ['metro.config.js'] },
      jest: { config: ['jest.config.js'] },
      ignoreDependencies: [
        // Expo web / partial auth / analytics (dynamic or platform entry)
        'react-dom',
        'posthog-js',
        'kupapay-partial-auth-browser',
      ],
    },
    '@cost-share/web': {
      entry: ['middleware.ts', 'next.config.ts', '**/*.{test,spec}.{ts,tsx,mjs}'],
      project: ['**/*.{ts,tsx,mjs}'],
      ignoreFiles: ['locales/**'],
      ignoreDependencies: ['sharp'],
    },
    '@cost-share/shared': {
      entry: ['src/index.ts', '**/*.{test,spec}.{ts,tsx}'],
      project: ['src/**/*.{ts,tsx}'],
    },
  },
  ignoreWorkspaces: ['apps/mobile/modules/**'],
};

export default config;
