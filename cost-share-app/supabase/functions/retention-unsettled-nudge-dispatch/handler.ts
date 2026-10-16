export interface RetentionNudgeDeps {
    run(limit: number): Promise<Record<string, unknown>>;
}

export async function dispatchRetentionUnsettledNudges(
    deps: RetentionNudgeDeps,
    limit = 100,
): Promise<Record<string, unknown>> {
    const result = await deps.run(limit);
    return { ok: true, ...result };
}
