import { sentryTracesSampleRate } from '../../lib/sentryTracesSampleRate';

describe('sentryTracesSampleRate', () => {
    it('samples 20% in production', () => {
        expect(sentryTracesSampleRate('production')).toBe(0.2);
    });

    it('samples 100% in development and previews', () => {
        expect(sentryTracesSampleRate('development')).toBe(1);
        expect(sentryTracesSampleRate(undefined)).toBe(1);
    });
});
