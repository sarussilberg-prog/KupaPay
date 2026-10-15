/** Daily cron: run DB smart payment reminder digest (Pro groups). */

export interface SmartReminderDispatchResult {
    sent: number;
    skipped: number;
}

export interface SmartReminderDispatchDeps {
    runDispatch(): Promise<SmartReminderDispatchResult>;
}

export async function dispatchSmartPaymentReminders(
    deps: SmartReminderDispatchDeps,
): Promise<SmartReminderDispatchResult> {
    return deps.runDispatch();
}
