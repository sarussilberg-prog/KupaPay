import {
    APP_MARKETING_VERSION,
    APP_VERSION,
    bumpDevPrereleaseVersion,
    stripDevPrerelease,
} from '../version';

describe('APP_VERSION', () => {
    it('includes dev prerelease on dev branch SSOT', () => {
        expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+-dev\.\d+$/);
    });

    it('marketing version is clean semver', () => {
        expect(APP_MARKETING_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
        expect(stripDevPrerelease(APP_VERSION)).toBe(APP_MARKETING_VERSION);
    });
});

describe('bumpDevPrereleaseVersion', () => {
    it('increments dev counter', () => {
        expect(bumpDevPrereleaseVersion('2.2.0-dev.3', '2.2.0')).toBe('2.2.0-dev.4');
    });

    it('seeds dev.1 from clean semver', () => {
        expect(bumpDevPrereleaseVersion('2.2.0', '2.2.0')).toBe('2.2.0-dev.1');
    });
});
