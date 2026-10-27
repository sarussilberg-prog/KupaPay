import AsyncStorage from '@react-native-async-storage/async-storage';

const ATTRIBUTION_CHECKED_KEY = '@kupapay/deferred_invite_attribution_v1';

export async function hasCheckedDeferredInviteAttribution(): Promise<boolean> {
    return (await AsyncStorage.getItem(ATTRIBUTION_CHECKED_KEY)) === '1';
}

export async function markDeferredInviteAttributionChecked(): Promise<void> {
    await AsyncStorage.setItem(ATTRIBUTION_CHECKED_KEY, '1');
}
