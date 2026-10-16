import {
    assertCronPost,
    createServiceSupabase,
    cronWebhookSecret,
    jsonInternalError,
    jsonOk,
} from '../cron-webhook/auth.ts';
import { dispatchStorageCleanup } from './handler.ts';

const SECRET_ENV = 'STORAGE_CLEANUP_WEBHOOK_SECRET';

Deno.serve(async (req) => {
    const denied = assertCronPost(req, cronWebhookSecret(SECRET_ENV));
    if (denied) return denied;

    const sb = createServiceSupabase();

    try {
        const result = await dispatchStorageCleanup({
            async listPending(limit) {
                const { data, error } = await sb
                    .from('storage_cleanup_queue')
                    .select('id, bucket, object_path')
                    .is('processed_at', null)
                    .order('requested_at', { ascending: true })
                    .limit(limit);
                if (error) throw error;
                return (data ?? []) as Array<{ id: string; bucket: string; object_path: string }>;
            },
            async removeObjects(bucket, paths) {
                const { error } = await sb.storage.from(bucket).remove(paths);
                if (error) return { error: error.message };
                return {};
            },
            async markProcessed(id) {
                const { error } = await sb
                    .from('storage_cleanup_queue')
                    .update({ processed_at: new Date().toISOString(), error: null })
                    .eq('id', id);
                if (error) throw error;
            },
            async markFailed(id, message) {
                const { error } = await sb
                    .from('storage_cleanup_queue')
                    .update({ processed_at: new Date().toISOString(), error: message })
                    .eq('id', id);
                if (error) throw error;
            },
        });
        return jsonOk({ ok: true, ...result });
    } catch (e) {
        return jsonInternalError('storage-cleanup-dispatch failed', e);
    }
});
