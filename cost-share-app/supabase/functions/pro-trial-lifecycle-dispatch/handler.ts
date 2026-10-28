/** Daily cron: enqueue Pro trial lifecycle pushes via activity_events → send-push (#402). */

export interface DispatchDeps {
    run(limit: number): Promise<Record<string, unknown>>;
}

export async function dispatchProTrialLifecycle(
    deps: DispatchDeps,
    limit = 200,
): Promise<Record<string, unknown>> {
    return deps.run(limit);
}
