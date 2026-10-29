export const PENDING_AMBASSADOR_REF_STORAGE_KEY = 'kupapay.pending_ambassador_ref.v1'; // gitleaks:allow

export async function loadPendingAmbassadorRef(
    getItem: (key: string) => Promise<string | null>,
): Promise<string | null> {
    const raw = await getItem(PENDING_AMBASSADOR_REF_STORAGE_KEY);
    if (!raw) return null;
    return raw;
}

export async function persistPendingAmbassadorRef(
    setItem: (key: string, value: string) => Promise<void>,
    code: string,
): Promise<void> {
    await setItem(PENDING_AMBASSADOR_REF_STORAGE_KEY, code);
}

export async function clearPendingAmbassadorRef(
    removeItem: (key: string) => Promise<void>,
): Promise<void> {
    await removeItem(PENDING_AMBASSADOR_REF_STORAGE_KEY);
}
