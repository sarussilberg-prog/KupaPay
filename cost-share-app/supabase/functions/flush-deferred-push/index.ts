import {
    assertCronPost,
    createServiceSupabase,
    cronWebhookSecret,
    jsonInternalError,
    jsonOk,
} from '../cron-webhook/auth.ts';
import { flushDeferredPushes } from './handler.ts';
import type { ActivityRecord } from '../send-push/handler.ts';

Deno.serve(async (req) => {
    const denied = assertCronPost(req, cronWebhookSecret('FLUSH_DEFERRED_PUSH_WEBHOOK_SECRET'));
    if (denied) return denied;

    const sb = createServiceSupabase();
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    try {
        const result = await flushDeferredPushes({
            supabaseUrl: url,
            serviceRole,
            async listDeferred(limit) {
                const { data, error } = await sb.rpc('list_deferred_push_deliveries', { p_limit: limit });
                if (error) throw error;
                return (data ?? []).map((row: { activity_event_id?: string } | string) =>
                    typeof row === 'string' ? row : (row.activity_event_id ?? ''),
                ).filter(Boolean);
            },
            async loadEvent(id) {
                const { data, error } = await sb.from('activity_events').select('*').eq('id', id).maybeSingle();
                if (error || !data) return null;
                return data as ActivityRecord;
            },
            async resetDeferred(id) {
                await sb.from('push_deliveries')
                    .delete()
                    .eq('activity_event_id', id)
                    .eq('last_error', 'quiet_hours_deferred');
            },
        });
        return jsonOk({ ok: true, ...result });
    } catch (e) {
        return jsonInternalError('flush-deferred-push failed', e);
    }
});
