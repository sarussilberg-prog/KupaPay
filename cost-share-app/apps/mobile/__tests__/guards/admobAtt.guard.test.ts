import { readFileSync } from 'fs';
import { join } from 'path';

const APP_JSON = join(__dirname, '../../app.json');

describe('AdMob ATT guard', () => {
    it('does not declare NSUserTrackingUsageDescription (no IDFA / ATT prompt)', () => {
        const raw = readFileSync(APP_JSON, 'utf8');
        expect(raw).not.toContain('NSUserTrackingUsageDescription');
        expect(raw).not.toContain('UserTrackingUsageDescription');
    });
});
