import fs from 'fs';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../../../../..');
const WORKFLOW = path.join(REPO_ROOT, '.github/workflows/play-internal-android.yml');
const APP_JSON = path.join(REPO_ROOT, 'cost-share-app/apps/mobile/app.json');

describe('Play Internal Android release workflow', () => {
    it('defines a manual workflow with EAS production Android build and internal submit', () => {
        const yaml = fs.readFileSync(WORKFLOW, 'utf8');
        expect(yaml).toContain('workflow_dispatch');
        expect(yaml).toContain('pro_enabled');
        expect(yaml).toContain('--platform android');
        expect(yaml).toContain('--profile production');
        expect(yaml).toContain('EXPO_PUBLIC_REVENUECAT_ANDROID_KEY');
        expect(yaml).toContain('EXPO_PUBLIC_ADMOB_ANDROID_APP_ID');
        expect(yaml).toContain('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON');
        expect(yaml).toContain('eas-submit-play-internal.sh');
        expect(yaml).toMatch(/build:version:get -p android/);
        expect(yaml).toContain('::error::EXPO_PUBLIC_REVENUECAT_ANDROID_KEY is required');
    });

    it('declares Google Play Billing permission for in-app purchases', () => {
        const app = JSON.parse(fs.readFileSync(APP_JSON, 'utf8')) as {
            expo: { android: { permissions: string[] } };
        };
        expect(app.expo.android.permissions).toContain('com.android.vending.BILLING');
    });
});
