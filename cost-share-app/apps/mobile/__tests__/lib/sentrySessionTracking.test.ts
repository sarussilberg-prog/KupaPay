/**
 * Guards Release Health config (#427) without initializing native Sentry in Jest.
 */
describe('sentry session tracking config', () => {
    it('documents auto session tracking for crash-free rate', () => {
        const source = require('fs').readFileSync(
            require('path').join(__dirname, '../../lib/sentry.ts'),
            'utf8',
        );
        expect(source).toMatch(/enableAutoSessionTracking:\s*true/);
        expect(source).toMatch(/release,/);
    });
});
