import fs from 'fs';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../../../../..');
const SCRIPT = path.join(REPO_ROOT, 'cost-share-app/apps/web/scripts/build-app-web.sh');
const DEV_DEFAULTS = path.join(REPO_ROOT, 'cost-share-app/apps/web/supabase-public.development.defaults');

describe('build-app-web.sh email OTP gating (#376)', () => {
    it('enables EXPO_PUBLIC_ENABLE_EMAIL_AUTH only for dev Vercel project IDs', () => {
        const sh = fs.readFileSync(SCRIPT, 'utf8');
        expect(sh).toContain('IS_DEV_VERCEL_PROJECT" == true');
        expect(sh).toContain('export EXPO_PUBLIC_ENABLE_EMAIL_AUTH=true');
        expect(sh).not.toMatch(
            /VERCEL_ENV.*!=.*production[\s\S]*EXPO_PUBLIC_ENABLE_EMAIL_AUTH/,
        );
    });

    it('does not bake email auth into shared development defaults (prod previews source that file)', () => {
        const defaults = fs.readFileSync(DEV_DEFAULTS, 'utf8');
        expect(defaults).not.toContain('EXPO_PUBLIC_ENABLE_EMAIL_AUTH');
    });
});
