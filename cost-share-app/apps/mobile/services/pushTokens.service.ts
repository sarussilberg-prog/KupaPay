import { supabase } from '../lib/supabase';
import type { PushPlatform } from '@cost-share/shared';

export interface RegisterTokenInput {
    token: string;
    platform: PushPlatform;
    deviceId?: string;
    appVersion?: string;
}

// Push registration must never break sign-in; errors are logged, not thrown.
export async function registerPushToken(input: RegisterTokenInput): Promise<void> {
    const { error } = await supabase.rpc('register_device_token', {
        p_token: input.token,
        p_platform: input.platform,
        p_device_id: input.deviceId ?? null,
        p_app_version: input.appVersion ?? null,
    });
    if (error) console.warn('registerPushToken failed', error);
}

export async function unregisterPushToken(token: string): Promise<void> {
    const { error } = await supabase.rpc('unregister_device_token', { p_token: token });
    if (error) console.warn('unregisterPushToken failed', error);
}
