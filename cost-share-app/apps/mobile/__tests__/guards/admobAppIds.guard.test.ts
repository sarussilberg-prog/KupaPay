import { readFileSync } from 'fs';
import { join } from 'path';
import {
    ADMOB_ANDROID_APP_ID,
    ADMOB_IOS_APP_ID,
    ADMOB_REWARDED_ANDROID_UNIT_ID,
    ADMOB_REWARDED_IOS_UNIT_ID,
} from '../../lib/admobConfig';

const APP_JSON = join(__dirname, '../../app.json');
const ADMOB_CONFIG = join(__dirname, '../../lib/admobConfig.ts');
const USE_REWARDED = join(__dirname, '../../hooks/useRewardedAd.ts');

describe('AdMob production IDs guard', () => {
    it('app.json plugin uses production app IDs', () => {
        const raw = readFileSync(APP_JSON, 'utf8');
        expect(raw).toContain(ADMOB_IOS_APP_ID);
        expect(raw).toContain(ADMOB_ANDROID_APP_ID);
        expect(raw).not.toContain('~9463098647');
    });

    it('admobConfig defines production rewarded unit IDs', () => {
        const raw = readFileSync(ADMOB_CONFIG, 'utf8');
        expect(raw).toContain(ADMOB_REWARDED_IOS_UNIT_ID);
        expect(raw).toContain(ADMOB_REWARDED_ANDROID_UNIT_ID);
        expect(raw).not.toContain('2901559727');
    });

    it('rewarded hook imports admobConfig (dev uses TestIds)', () => {
        const raw = readFileSync(USE_REWARDED, 'utf8');
        expect(raw).toContain("from '../lib/admobConfig'");
        expect(raw).toContain('ADMOB_REWARDED_IOS_UNIT_ID');
    });
});
