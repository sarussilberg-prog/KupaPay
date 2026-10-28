import fs from 'fs';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../../../../..');
const SCRIPT = path.join(REPO_ROOT, 'cost-share-app/scripts/ci-expo-mobile-config.sh');

/** CI expo config check must not enable Pro unless the env var is explicitly true (#587). */
describe('ci-expo-mobile-config.sh — Pro default off when unset', () => {
    it('defaults EXPO_PUBLIC_KUPAPAY_PRO_ENABLED to false, not true', () => {
        const sh = fs.readFileSync(SCRIPT, 'utf8');
        expect(sh).toContain('EXPO_PUBLIC_KUPAPAY_PRO_ENABLED');
        expect(sh).not.toMatch(/EXPO_PUBLIC_KUPAPAY_PRO_ENABLED:-true/);
        expect(sh).toMatch(/EXPO_PUBLIC_KUPAPAY_PRO_ENABLED:-false/);
    });
});
