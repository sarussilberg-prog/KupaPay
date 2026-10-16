import * as SecureStore from 'expo-secure-store';

/** SecureStore value limit (~2048 bytes on iOS); chunk larger Supabase sessions. */
const CHUNK_SIZE = 1800;
const META_SUFFIX = '.__chunk_count__';

async function removeChunked(key: string, chunkCount: number): Promise<void> {
    for (let i = 0; i < chunkCount; i++) {
        await SecureStore.deleteItemAsync(`${key}.${i}`).catch(() => undefined);
    }
    await SecureStore.deleteItemAsync(`${key}${META_SUFFIX}`).catch(() => undefined);
}

export async function secureAuthGetItem(key: string): Promise<string | null> {
    const single = await SecureStore.getItemAsync(key);
    if (single != null) return single;

    const meta = await SecureStore.getItemAsync(`${key}${META_SUFFIX}`);
    if (!meta) return null;

    const chunkCount = Number.parseInt(meta, 10);
    if (!Number.isFinite(chunkCount) || chunkCount < 1) return null;

    const parts: string[] = [];
    for (let i = 0; i < chunkCount; i++) {
        const part = await SecureStore.getItemAsync(`${key}.${i}`);
        if (part == null) return null;
        parts.push(part);
    }
    return parts.join('');
}

export async function secureAuthSetItem(key: string, value: string): Promise<void> {
    const existingMeta = await SecureStore.getItemAsync(`${key}${META_SUFFIX}`);
    if (existingMeta) {
        const n = Number.parseInt(existingMeta, 10);
        if (Number.isFinite(n) && n > 0) await removeChunked(key, n);
    }
    await SecureStore.deleteItemAsync(key).catch(() => undefined);

    if (value.length <= CHUNK_SIZE) {
        await SecureStore.setItemAsync(key, value);
        return;
    }

    const chunkCount = Math.ceil(value.length / CHUNK_SIZE);
    await SecureStore.setItemAsync(`${key}${META_SUFFIX}`, String(chunkCount));
    for (let i = 0; i < chunkCount; i++) {
        const slice = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        await SecureStore.setItemAsync(`${key}.${i}`, slice);
    }
}

export async function secureAuthRemoveItem(key: string): Promise<void> {
    const meta = await SecureStore.getItemAsync(`${key}${META_SUFFIX}`);
    if (meta) {
        const n = Number.parseInt(meta, 10);
        if (Number.isFinite(n) && n > 0) await removeChunked(key, n);
    }
    await SecureStore.deleteItemAsync(key).catch(() => undefined);
}
