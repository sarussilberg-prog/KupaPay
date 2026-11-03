import fs from 'fs';
import path from 'path';

const MOBILE_DIR = path.resolve(__dirname, '../..');
const EAS_JSON = path.join(MOBILE_DIR, 'eas.json');
const PROD_ENV_EXAMPLE = path.join(MOBILE_DIR, '.env.production.example');

const DEV_SUPABASE_REF = 'drxfbicunusmipdgbgdk';
const PROD_SUPABASE_REF = 'jfqxjjjbpxbwwvoygahu';

/** Env keys that must never be enabled in store / production EAS profiles. */
const E2E_ENV_KEYS = [
    'EXPO_PUBLIC_E2E_MAESTRO_AUTH',
    'EXPO_PUBLIC_E2E',
    'EXPO_PUBLIC_E2E_FIXTURES',
    'EXPO_PUBLIC_E2E_TEST_EMAIL',
] as const;

const STORE_BUILD_PROFILES = ['production', 'preview', 'asc-screenshots'] as const;

function parseEasProfiles(): Record<string, { env?: Record<string, string> }> {
    const raw = JSON.parse(fs.readFileSync(EAS_JSON, 'utf8')) as {
        build?: Record<string, { env?: Record<string, string> }>;
    };
    return raw.build ?? {};
}

function envEnablesE2e(env: Record<string, string> | undefined): string | null {
    if (!env) return null;
    for (const key of E2E_ENV_KEYS) {
        const value = env[key];
        if (value == null || value === '') continue;
        if (key === 'EXPO_PUBLIC_E2E' && value !== '1' && value !== 'true') continue;
        if (key === 'EXPO_PUBLIC_E2E_MAESTRO_AUTH' && value !== 'true' && value !== '1') continue;
        if (key === 'EXPO_PUBLIC_E2E_FIXTURES' && value !== '1' && value !== 'true') continue;
        return `${key}=${value}`;
    }
    return null;
}

function envPointsAtDevSupabase(env: Record<string, string> | undefined): boolean {
    const url = env?.EXPO_PUBLIC_SUPABASE_URL ?? '';
    return url.includes(DEV_SUPABASE_REF);
}

describe('E2E flags and dev Supabase — not in production builds (#695 Phase 0)', () => {
    it('eas.json store profiles do not enable E2E test UI or probes', () => {
        const profiles = parseEasProfiles();
        for (const name of STORE_BUILD_PROFILES) {
            const profile = profiles[name];
            if (!profile) {
                throw new Error(`missing eas build profile: ${name}`);
            }
            const hit = envEnablesE2e(profile.env);
            expect(hit).toBeNull();
        }
    });

    it('eas.json production profile uses production Supabase host, not dev', () => {
        const env = parseEasProfiles().production?.env;
        const url = env?.EXPO_PUBLIC_SUPABASE_URL ?? '';
        if (url) {
            expect(url).toContain(PROD_SUPABASE_REF);
            expect(url).not.toContain(DEV_SUPABASE_REF);
        }
    });

    it('.env.production.example does not enable E2E flags or dev Supabase ref', () => {
        const text = fs.readFileSync(PROD_ENV_EXAMPLE, 'utf8');
        for (const key of E2E_ENV_KEYS) {
            expect(text).not.toMatch(new RegExp(`^${key}=`, 'm'));
        }
        expect(text).toContain(PROD_SUPABASE_REF);
        expect(text).not.toContain(DEV_SUPABASE_REF);
    });

    it('dedicated eas e2e profile enables layout fixture mode without dev Supabase URL', () => {
        const e2e = parseEasProfiles().e2e;
        expect(e2e).toBeDefined();
        expect(e2e?.env?.EXPO_PUBLIC_E2E_FIXTURES).toBe('1');
        expect(envEnablesE2e(e2e?.env)).toMatch(/EXPO_PUBLIC_E2E/);
        expect(envPointsAtDevSupabase(e2e?.env)).toBe(false);
        expect(envPointsAtDevSupabase(parseEasProfiles().production?.env)).toBe(false);
    });
});
