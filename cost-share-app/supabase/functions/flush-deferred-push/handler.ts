import type { ActivityRecord } from '../send-push/handler.ts';
import { processActivityEvent } from '../send-push/handler.ts';
import { makeSupabaseDeps } from '../send-push/deps.ts';

export interface FlushDeps {
    listDeferred(limit: number): Promise<string[]>;
    loadEvent(id: string): Promise<ActivityRecord | null>;
    resetDeferred(id: string): Promise<void>;
    supabaseUrl: string;
    serviceRole: string;
}

export async function flushDeferredPushes(deps: FlushDeps, limit = 50): Promise<{ flushed: number }> {
    const ids = await deps.listDeferred(limit);
    const pushDeps = makeSupabaseDeps({ url: deps.supabaseUrl, serviceRole: deps.serviceRole });
    let flushed = 0;
    for (const id of ids) {
        const record = await deps.loadEvent(id);
        if (!record) continue;
        await deps.resetDeferred(id);
        const outcome = await processActivityEvent(record, pushDeps, { bypassQuietHours: true });
        if (outcome === 'sent' || outcome === 'deferred' || outcome === 'duplicate') {
            flushed += 1;
        }
    }
    return { flushed };
}
