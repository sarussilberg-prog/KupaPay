/** Pro smart payment reminders — throttle + digest copy (pure). */

export const SMART_REMINDER_MIN_DAYS = 3;

export type SmartReminderIntervalDays = 3 | 7 | 14 | null;

export function canSendSmartReminderToDebtor(
    lastSentAt: Date | string | null | undefined,
    now: Date = new Date(),
): boolean {
    if (lastSentAt == null) return true;
    const last = lastSentAt instanceof Date ? lastSentAt : new Date(lastSentAt);
    const gapMs = SMART_REMINDER_MIN_DAYS * 24 * 60 * 60 * 1000;
    return now.getTime() - last.getTime() >= gapMs;
}

export function buildSmartReminderWhatsAppBody(input: {
    groupName: string;
    debtorName: string;
    amountLines: string[];
    settleUrl?: string | null;
    introLine: string;
    andWord: string;
}): string {
    const amounts =
        input.amountLines.length <= 1
            ? (input.amountLines[0] ?? '')
            : input.amountLines.slice(0, -1).join(', ') + input.andWord + input.amountLines[input.amountLines.length - 1];
    const lines = [
        input.introLine
            .replace('{{debtor}}', input.debtorName)
            .replace('{{group}}', input.groupName)
            .replace('{{amounts}}', amounts),
    ];
    if (input.settleUrl) lines.push(input.settleUrl);
    return lines.join('\n');
}
