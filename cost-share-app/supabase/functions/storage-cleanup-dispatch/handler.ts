export interface CleanupRow {
    id: string;
    bucket: string;
    object_path: string;
}

export interface CleanupDeps {
    listPending(limit: number): Promise<CleanupRow[]>;
    removeObjects(bucket: string, paths: string[]): Promise<{ error?: string }>;
    markProcessed(id: string): Promise<void>;
    markFailed(id: string, error: string): Promise<void>;
}

const BATCH = 50;

export async function dispatchStorageCleanup(
    deps: CleanupDeps,
    limit = BATCH,
): Promise<{ processed: number; failed: number }> {
    const rows = await deps.listPending(limit);
    let processed = 0;
    let failed = 0;

    const byBucket = new Map<string, CleanupRow[]>();
    for (const row of rows) {
        const list = byBucket.get(row.bucket) ?? [];
        list.push(row);
        byBucket.set(row.bucket, list);
    }

    for (const [bucket, bucketRows] of byBucket) {
        const paths = bucketRows.map(r => r.object_path);
        const { error } = await deps.removeObjects(bucket, paths);
        if (error) {
            for (const row of bucketRows) {
                await deps.markFailed(row.id, error);
                failed += 1;
            }
            continue;
        }
        for (const row of bucketRows) {
            await deps.markProcessed(row.id);
            processed += 1;
        }
    }

    return { processed, failed };
}
