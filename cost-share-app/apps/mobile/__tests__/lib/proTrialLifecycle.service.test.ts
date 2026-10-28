import { resolveInAppProTrialTouch } from '../../services/proTrialLifecycle.service';

describe('resolveInAppProTrialTouch', () => {
    it('returns day 1 touch early in trial', () => {
        const trialEnd = new Date(Date.now() + 13 * 24 * 60 * 60 * 1000).toISOString();
        const touch = resolveInAppProTrialTouch({
            trialEndsAtIso: trialEnd,
            lifecycleSent: [],
            featureUsage: {},
            language: 'en',
        });
        expect(touch?.day).toBe(1);
        expect(touch?.title.length).toBeGreaterThan(0);
        expect(touch?.body.length).toBeGreaterThan(0);
    });
});
