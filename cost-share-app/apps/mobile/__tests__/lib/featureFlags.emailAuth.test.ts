describe('EMAIL_AUTH_ENABLED', () => {
    const envKey = 'EXPO_PUBLIC_ENABLE_EMAIL_AUTH';

    afterEach(() => {
        delete process.env[envKey];
        jest.resetModules();
    });

    it('is false unless EXPO_PUBLIC_ENABLE_EMAIL_AUTH=true', () => {
        process.env[envKey] = 'false';
        jest.isolateModules(() => {
            const { EMAIL_AUTH_ENABLED } = require('../../lib/featureFlags');
            expect(EMAIL_AUTH_ENABLED).toBe(false);
        });

        process.env[envKey] = 'true';
        jest.isolateModules(() => {
            const { EMAIL_AUTH_ENABLED } = require('../../lib/featureFlags');
            expect(EMAIL_AUTH_ENABLED).toBe(true);
        });
    });
});
