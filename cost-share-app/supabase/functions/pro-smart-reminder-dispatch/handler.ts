export interface SmartReminderDispatchDeps {
    run(limit: number): Promise<Record<string, unknown>>;
}

export async function dispatchSmartPaymentReminders(
    deps: SmartReminderDispatchDeps,
    limit = 100,
): Promise<Record<string, unknown>> {
    const result = await deps.run(limit);
    return { ok: true, ...result };
}
