import { sentryReleaseMetadata } from '../sentryReleaseMetadata';

describe('sentryReleaseMetadata', () => {
    it('builds release and dist', () => {
        expect(
            sentryReleaseMetadata({ slug: 'kupapay', version: '2.2.0-dev.1', buildNumber: '99' }),
        ).toEqual({
            release: 'kupapay@2.2.0-dev.1+99',
            dist: '99',
        });
    });
});
