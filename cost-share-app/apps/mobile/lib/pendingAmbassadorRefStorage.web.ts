import {
    clearPendingAmbassadorRef as clearCore,
    loadPendingAmbassadorRef as loadCore,
    persistPendingAmbassadorRef as persistCore,
} from './pendingAmbassadorRefStorageCore';

function storage(): Storage | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
}

export async function loadPendingAmbassadorRef(): Promise<string | null> {
    const s = storage();
    if (!s) return null;
    return loadCore(async (key) => s.getItem(key));
}

export async function persistPendingAmbassadorRef(code: string): Promise<void> {
    const s = storage();
    if (!s) return;
    await persistCore(async (key, value) => {
        s.setItem(key, value);
    }, code);
}

export async function clearPendingAmbassadorRef(): Promise<void> {
    const s = storage();
    if (!s) return;
    await clearCore(async (key) => {
        s.removeItem(key);
    });
}
