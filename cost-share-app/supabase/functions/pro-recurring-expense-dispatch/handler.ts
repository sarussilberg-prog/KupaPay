/**
 * Daily cron: materialize due recurring expenses (idempotent RPC).
 */

export interface RecurringDispatchDeps {
    generateDue(limit: number): Promise<{ created?: number; skipped?: boolean }>;
}

export async function dispatchRecurringExpenses(
    deps: RecurringDispatchDeps,
    limit = 200,
): Promise<{ ok: true; created: number; skipped: boolean }> {
    const result = await deps.generateDue(limit);
    return {
        ok: true,
        created: result.created ?? 0,
        skipped: result.skipped === true,
    };
}
