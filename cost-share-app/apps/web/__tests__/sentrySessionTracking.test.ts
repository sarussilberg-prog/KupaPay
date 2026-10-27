/**
 * Guards Release Health config (#427) for the Next.js site.
 */
describe('web sentry session tracking config', () => {
    it('documents auto session tracking for crash-free rate', () => {
        const source = require('fs').readFileSync(
            require('path').join(__dirname, '../lib/sentryInit.ts'),
            'utf8',
        );
        expect(source).toMatch(/autoSessionTracking:\s*true/);
        expect(source).toMatch(/release,/);
    });
});
