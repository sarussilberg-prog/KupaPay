import fs from 'node:fs';
import path from 'node:path';

const MOBILE_ROOT = path.resolve(__dirname, '../..');
const EAS_JSON = path.join(MOBILE_ROOT, 'eas.json');
const CI_MAESTRO = path.join(MOBILE_ROOT, 'scripts/ci-maestro-device-ui.sh');
const CI_GROUPS = path.join(MOBILE_ROOT, 'scripts/ci-groups-layout-diagnostics.sh');

const E2E_TEST_ONLY_FLAGS = ['EXPO_PUBLIC_E2E_XX_LONG_LOCALE', 'EXPO_PUBLIC_E2E_MAESTRO_AUTH'] as const;

function productionEnvBlock(): string {
    const eas = JSON.parse(fs.readFileSync(EAS_JSON, 'utf8')) as {
        build?: { production?: { env?: Record<string, string> } };
    };
    const env = eas.build?.production?.env ?? {};
    return JSON.stringify(env);
}

describe('E2E xx-long pseudo-locale must not ship in production config', () => {
    it('eas.json production profile does not enable E2E-only flags', () => {
        const block = productionEnvBlock();
        for (const flag of E2E_TEST_ONLY_FLAGS) {
            expect(block).not.toContain(`${flag}`);
        }
    });

    it('Maestro CI scripts set E2E auth only in CI, not in eas production env', () => {
        const maestro = fs.readFileSync(CI_MAESTRO, 'utf8');
        const groups = fs.readFileSync(CI_GROUPS, 'utf8');
        expect(maestro).toContain('EXPO_PUBLIC_E2E_MAESTRO_AUTH=true');
        expect(groups).toMatch(/EXPO_PUBLIC_E2E_(MAESTRO_AUTH|FIXTURES)/);
        expect(productionEnvBlock()).not.toMatch(/EXPO_PUBLIC_E2E_MAESTRO_AUTH.*true/);
    });

    it('featureFlags treats xx-long as opt-in via EXPO_PUBLIC_E2E_XX_LONG_LOCALE only', () => {
        const src = fs.readFileSync(path.join(MOBILE_ROOT, 'lib/featureFlags.ts'), 'utf8');
        expect(src).toContain('EXPO_PUBLIC_E2E_XX_LONG_LOCALE');
        expect(src).toMatch(/E2E_XX_LONG_LOCALE_ENABLED[\s\S]*=== 'true'/);
    });
});
