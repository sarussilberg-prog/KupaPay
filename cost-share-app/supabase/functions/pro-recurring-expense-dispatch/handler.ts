/**
 * Daily cron: materialize due recurring expenses (idempotent RPC).
 */

export interface RecurringDispatchDeps {
    generateDue(limit: number): Promise<{ created?: number; skipped?: boolean }>;
}

const DEFAULT_MAX_ROUNDS = 20;

export async function dispatchRecurringExpenses(
    deps: RecurringDispatchDeps,
    limit = 200,
    maxRounds = DEFAULT_MAX_ROUNDS,
): Promise<{ ok: true; created: number; skipped: boolean }> {
    let created = 0;
    for (let round = 0; round < maxRounds; round += 1) {
        const result = await deps.generateDue(limit);
        if (result.skipped === true) {
            return { ok: true, created, skipped: true };
        }
        const batch = result.created ?? 0;
        created += batch;
        if (batch < limit) {
            break;
        }
    }
    return { ok: true, created, skipped: false };
}
