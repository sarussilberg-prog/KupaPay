import {
    buildSmartReminderWhatsAppBody,
    canSendSmartReminderToDebtor,
    SMART_REMINDER_MIN_DAYS,
} from '../smartPaymentReminder';

describe('canSendSmartReminderToDebtor', () => {
    const now = new Date('2026-06-10T12:00:00.000Z');

    it('allows first send', () => {
        expect(canSendSmartReminderToDebtor(null, now)).toBe(true);
    });

    it(`blocks within ${SMART_REMINDER_MIN_DAYS} days`, () => {
        const recent = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
        expect(canSendSmartReminderToDebtor(recent, now)).toBe(false);
    });

    it('allows after min gap', () => {
        const old = new Date(now.getTime() - SMART_REMINDER_MIN_DAYS * 24 * 60 * 60 * 1000);
        expect(canSendSmartReminderToDebtor(old, now)).toBe(true);
    });
});

describe('buildSmartReminderWhatsAppBody', () => {
    it('joins amounts and appends settle link', () => {
        const body = buildSmartReminderWhatsAppBody({
            groupName: 'Trip',
            debtorName: 'Bob',
            amountLines: ['USD 10.00', 'EUR 5.00'],
            settleUrl: 'https://app.example/sr/abc',
            introLine: 'Hi {{debtor}}, you owe {{amounts}} in {{group}}',
            andWord: ' and ',
        });
        expect(body).toContain('Bob');
        expect(body).toContain('USD 10.00');
        expect(body).toContain('EUR 5.00');
        expect(body).toContain('https://app.example/sr/abc');
    });
});
