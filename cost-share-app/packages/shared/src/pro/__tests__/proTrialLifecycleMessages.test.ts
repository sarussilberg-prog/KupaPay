import { proTrialFeatureUsageLine, renderProTrialLifecyclePush } from '../proTrialLifecycleMessages';

describe('proTrialLifecycleMessages', () => {
    it('renders day 10 copy in Hebrew', () => {
        const r = renderProTrialLifecyclePush(10, {}, 'he');
        expect(r.title).toContain('4');
        expect(r.body).toContain('הגדרות');
    });

    it('lists used Pro features in Arabic', () => {
        const line = proTrialFeatureUsageLine({ receiptScan: true, tripBudget: true }, 'ar');
        expect(line).toContain('مسح');
        expect(line).toContain('ميزانية');
    });

    it('falls back to English for unknown locale codes', () => {
        const r = renderProTrialLifecyclePush(13, {}, 'xx');
        expect(r.title).toMatch(/renews tomorrow/i);
    });
});
