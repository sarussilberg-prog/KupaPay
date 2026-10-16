import fs from 'fs';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../../../../..');
const APP_JSON = path.join(REPO_ROOT, 'cost-share-app/apps/mobile/app.json');
const EAS_JSON = path.join(REPO_ROOT, 'cost-share-app/apps/mobile/eas.json');
const ADMOB_IDS = path.join(REPO_ROOT, 'cost-share-app/apps/mobile/lib/admob-app-ids.json');
const APP_CONFIG = path.join(REPO_ROOT, 'cost-share-app/apps/mobile/app.config.ts');

describe('Android Play readiness (Expo config guard)', () => {
    it('uses production package, RTL, billing, AdMob, adaptive icon, and splash', () => {
        const app = JSON.parse(fs.readFileSync(APP_JSON, 'utf8')) as {
            expo: {
                android: {
                    package: string;
                    supportsRtl?: boolean;
                    permissions: string[];
                    blockedPermissions?: string[];
                    adaptiveIcon: {
                        backgroundColor: string;
                        foregroundImage: string;
                        backgroundImage: string;
                    };
                };
                plugins: unknown[];
            };
        };

        expect(app.expo.android.package).toBe('com.kupapay.mobile');
        expect(app.expo.android.supportsRtl).toBe(true);
        expect(app.expo.android.permissions).toContain('com.android.vending.BILLING');
        expect(app.expo.android.blockedPermissions).toEqual(
            expect.arrayContaining(['android.permission.RECORD_AUDIO', 'android.permission.READ_MEDIA_IMAGES']),
        );
        expect(app.expo.android.adaptiveIcon.backgroundColor).toBe('#ffffff');
        expect(app.expo.android.adaptiveIcon.foregroundImage).toContain('android-icon-foreground');
        expect(app.expo.android.adaptiveIcon.backgroundImage).toContain('android-icon-background');

        const pluginsJson = JSON.stringify(app.expo.plugins);
        expect(pluginsJson).toContain('expo-splash-screen');
        expect(pluginsJson).toContain('react-native-google-mobile-ads');

        const admob = JSON.parse(fs.readFileSync(ADMOB_IDS, 'utf8')) as {
            ADMOB_ANDROID_APP_ID: string;
        };
        expect(pluginsJson).toContain(admob.ADMOB_ANDROID_APP_ID);

        const eas = JSON.parse(fs.readFileSync(EAS_JSON, 'utf8')) as {
            cli: { appVersionSource: string };
            build: { production: { autoIncrement?: boolean } };
            submit: { production: { android: { track: string } } };
        };
        expect(eas.cli.appVersionSource).toBe('remote');
        expect(eas.build.production.autoIncrement).toBe(true);
        expect(eas.submit.production.android.track).toBe('internal');

        const appConfigSrc = fs.readFileSync(APP_CONFIG, 'utf8');
        expect(appConfigSrc).toContain('versionJson.version');
    });
});
