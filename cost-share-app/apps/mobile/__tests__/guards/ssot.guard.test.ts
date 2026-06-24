import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { resolve } from 'path';
import { APP_VERSION } from '@cost-share/shared';

// Paths resolved from this file: cost-share-app/apps/mobile/__tests__/guards/
const MOBILE_DIR = resolve(__dirname, '../..'); // cost-share-app/apps/mobile
const APPS_DIR = resolve(__dirname, '../../..'); // cost-share-app/apps
const MONOREPO_DIR = resolve(__dirname, '../../../..'); // cost-share-app
const REPO_ROOT = resolve(__dirname, '../../../../..'); // git root (holds .github)

const read = (p: string): string => readFileSync(p, 'utf8');

const CANONICAL_TEAM_ID = 'HVW3H3DLRB';
const LEGACY_TEAM_ID = 'K3M6R85KA6';
const TEAM_ID_RE = /[A-Z0-9]{10}\.com\.kupapay\.mobile/;

// Only scan text/source files — never decode binaries (PNGs etc.) as UTF-8.
const TEXT_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|ya?ml|txt|html|css)$/;

function grepDir(dir: string, needle: string): string[] {
  const skip = new Set([
    'node_modules', '.next', 'dist', '.expo', 'build',
    '.turbo', 'coverage', 'out', 'web-build', '.vercel',
  ]);
  const hits: string[] = [];
  const walk = (d: string): void => {
    for (const entry of readdirSync(d)) {
      if (skip.has(entry)) continue;
      const full = resolve(d, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (TEXT_EXT.test(full) && read(full).includes(needle)) hits.push(full);
    }
  };
  walk(dir);
  return hits;
}

describe('Apple Team ID — single source of truth', () => {
  it('app.json declares the canonical Apple Team ID', () => {
    const appJson = JSON.parse(read(resolve(MOBILE_DIR, 'app.json')));
    expect(appJson.expo.ios.appleTeamId).toBe(CANONICAL_TEAM_ID);
  });

  it('the legacy team id appears in no scanned source', () => {
    // Scoped on purpose to the files/dirs that could carry a REAL team-id usage.
    // Do NOT widen this to the whole monorepo: the design docs (docs/superpowers/**,
    // docs/SSOT/APPLE_TEAM_ID.md) and this guard's own LEGACY_TEAM_ID constant
    // legitimately contain the string, so a repo-wide scan would false-fail.
    for (const f of [
      resolve(MOBILE_DIR, 'app.json'),
      resolve(MOBILE_DIR, 'app.config.ts'),
      resolve(MOBILE_DIR, 'App.tsx'),
      resolve(MONOREPO_DIR, 'supabase/functions/invite-landing/well-known.ts'),
    ]) {
      expect(read(f)).not.toContain(LEGACY_TEAM_ID);
    }
    expect(grepDir(resolve(APPS_DIR, 'web'), LEGACY_TEAM_ID)).toEqual([]);
  });

  it('no static .well-known file shadows the Vercel rewrite', () => {
    const wellKnown = resolve(APPS_DIR, 'web/public/.well-known');
    for (const name of ['apple-app-site-association', 'assetlinks.json']) {
      expect(existsSync(resolve(wellKnown, name))).toBe(false);
    }
  });

  it('the edge function derives appID from env, with no hardcoded team id', () => {
    const fn = read(resolve(MONOREPO_DIR, 'supabase/functions/invite-landing/well-known.ts'));
    expect(fn).toContain('${TEAM_ID}.com.kupapay.mobile');
    expect(fn).not.toMatch(TEAM_ID_RE);
  });

  it('App.tsx has no hardcoded AASA appID literal or handler', () => {
    const app = read(resolve(MOBILE_DIR, 'App.tsx'));
    expect(app).not.toMatch(TEAM_ID_RE);
    expect(app).not.toContain('apple-app-site-association');
  });
});

describe('App version — single source of truth', () => {
  const versionJsonPath = resolve(MONOREPO_DIR, 'packages/shared/version.json');
  const fileVersion = (): string => JSON.parse(read(versionJsonPath)).version;

  it('packages/shared/version.json holds a valid semver', () => {
    expect(fileVersion()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('APP_VERSION equals the version.json SSOT', () => {
    expect(APP_VERSION).toBe(fileVersion());
  });

  it('app.json has no version literal (it lives only in version.json)', () => {
    const appJson = JSON.parse(read(resolve(MOBILE_DIR, 'app.json')));
    expect(appJson.expo.version).toBeUndefined();
  });

  it('app.config.ts exists (the dynamic config that injects the version)', () => {
    expect(existsSync(resolve(MOBILE_DIR, 'app.config.ts'))).toBe(true);
  });

  it('app.config.ts injects the version from the shared version.json', () => {
    const cfg = read(resolve(MOBILE_DIR, 'app.config.ts'));
    expect(cfg).toContain('packages/shared/version.json');
    expect(cfg).toMatch(/version:\s*versionJson\.version/);
  });

  it('the per-app version.json is gone', () => {
    expect(existsSync(resolve(MOBILE_DIR, 'version.json'))).toBe(false);
  });

  it('the login screen reads APP_VERSION, not a json file', () => {
    const login = read(resolve(MOBILE_DIR, 'screens/auth/LoginScreen.tsx'));
    expect(login).toContain('APP_VERSION');
    expect(login).not.toContain('version.json');
  });

  it('the legal sheet shows the app version, not the document version', () => {
    const sheet = read(resolve(MOBILE_DIR, 'components/settings/LegalDocumentSheet.tsx'));
    expect(sheet).toContain('legal.appVersion');
    expect(sheet).toContain('APP_VERSION');
    expect(sheet).not.toContain('legal.versionLabel');
  });

  it('the removed versionLabel key is gone and appVersion exists in both locales', () => {
    for (const loc of ['he', 'en']) {
      const json = JSON.parse(read(resolve(MOBILE_DIR, `i18n/locales/${loc}.json`)));
      expect(json.legal.versionLabel).toBeUndefined();
      expect(typeof json.legal.appVersion).toBe('string');
    }
  });

  it('both bump workflows target the shared version.json', () => {
    for (const wf of ['bump-version-dev.yml', 'bump-version-main.yml']) {
      const text = read(resolve(REPO_ROOT, '.github/workflows', wf));
      expect(text).toContain('cost-share-app/packages/shared/version.json');
      expect(text).not.toContain('cost-share-app/apps/mobile/version.json');
    }
  });
});
