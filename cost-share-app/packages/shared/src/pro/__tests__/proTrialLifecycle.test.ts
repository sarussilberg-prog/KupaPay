import { dueProTrialLifecycleTouch, trialDayIndex } from '../proTrialLifecycle';

describe('proTrialLifecycle', () => {
    it('computes trial day index from start', () => {
        const start = new Date('2026-01-01T12:00:00Z');
        const now = new Date('2026-01-03T12:00:00Z');
        expect(trialDayIndex(start, now)).toBe(3);
    });

    it('returns day 1 touch when not sent', () => {
        const start = new Date(Date.now() - 36 * 60 * 60 * 1000);
        expect(dueProTrialLifecycleTouch(start, [])).toBe(1);
    });

    it('skips sent touches', () => {
        const start = new Date('2026-01-01T12:00:00Z');
        const now = new Date('2026-01-14T12:00:00Z');
        expect(dueProTrialLifecycleTouch(start, [1, 10], now)).toBe(13);
    });
});
