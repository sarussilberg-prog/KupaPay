import {
    assertCronPost,
    createServiceSupabase,
    cronWebhookSecret,
    jsonInternalError,
    jsonOk,
} from '../cron-webhook/auth.ts';
import { dispatchRecurringExpenses } from './handler.ts';

Deno.serve(async (req) => {
    const denied = assertCronPost(req, cronWebhookSecret());
    if (denied) return denied;

    const sb = createServiceSupabase();

    try {
        const result = await dispatchRecurringExpenses({
            async generateDue(limit) {
                const { data, error } = await sb.rpc('generate_due_recurring_expenses', {
                    p_limit: limit,
                });
                if (error) throw error;
                return (data ?? {}) as { created?: number; skipped?: boolean };
            },
        });
        return jsonOk(result);
    } catch (e) {
        return jsonInternalError('pro-recurring-expense-dispatch failed', e);
    }
});
