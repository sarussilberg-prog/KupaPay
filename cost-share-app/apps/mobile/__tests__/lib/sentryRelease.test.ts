import { APP_VERSION } from '@cost-share/shared';
import { sentryReleaseMetadata } from '../../lib/sentryRelease';

jest.mock('expo-application', () => ({
    nativeBuildVersion: '42',
}));

jest.mock('expo-constants', () => ({
    __esModule: true,
    default: {
        expoConfig: {
            slug: 'kupapay',
            version: '2.2.0-dev.1',
            ios: { buildNumber: '42' },
        },
    },
}));

describe('sentryReleaseMetadata', () => {
    it('builds release and dist for Sentry', () => {
        expect(sentryReleaseMetadata()).toEqual({
            release: `kupapay@${APP_VERSION}+42`,
            dist: '42',
        });
    });
});
