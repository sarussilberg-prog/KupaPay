import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    clearPendingAmbassadorRef as clearCore,
    loadPendingAmbassadorRef as loadCore,
    persistPendingAmbassadorRef as persistCore,
} from './pendingAmbassadorRefStorageCore';

export async function loadPendingAmbassadorRef(): Promise<string | null> {
    return loadCore((key) => AsyncStorage.getItem(key));
}

export async function persistPendingAmbassadorRef(code: string): Promise<void> {
    await persistCore((key, value) => AsyncStorage.setItem(key, value), code);
}

export async function clearPendingAmbassadorRef(): Promise<void> {
    await clearCore((key) => AsyncStorage.removeItem(key));
}
