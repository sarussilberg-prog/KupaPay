/** Web builds use localStorage via authStorage; SecureStore is native-only. */
export async function secureAuthGetItem(_key: string): Promise<string | null> {
    return null;
}

export async function secureAuthSetItem(_key: string, _value: string): Promise<void> {}

export async function secureAuthRemoveItem(_key: string): Promise<void> {}
