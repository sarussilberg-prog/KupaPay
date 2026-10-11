import { APP_VERSION } from '@cost-share/shared';
import { isAppVersionBelowMinimum } from '../lib/appVersionCompare';
import { supabase } from '../lib/supabase';

export type AppClientConfig = {
    minSupportedVersion: string;
    iosStoreUrl: string;
    androidStoreUrl: string;
};

export type MinimumVersionGateResult =
    | { status: 'ok' }
    | { status: 'update_required'; config: AppClientConfig }
    | { status: 'unknown' };

const DEFAULT_IOS =
    process.env.EXPO_PUBLIC_APP_STORE_URL ??
    'https://apps.apple.com/us/app/kupapay/id6780216665';
const DEFAULT_ANDROID =
    process.env.EXPO_PUBLIC_PLAY_STORE_URL ??
    'https://play.google.com/store/apps/details?id=com.kupapay.mobile';

function parseConfig(raw: unknown): AppClientConfig | null {
    if (!raw || typeof raw !== 'object') return null;
    const o = raw as Record<string, unknown>;
    const min = o.minSupportedVersion;
    if (typeof min !== 'string' || min.length === 0) return null;
    return {
        minSupportedVersion: min,
        iosStoreUrl: typeof o.iosStoreUrl === 'string' && o.iosStoreUrl ? o.iosStoreUrl : DEFAULT_IOS,
        androidStoreUrl:
            typeof o.androidStoreUrl === 'string' && o.androidStoreUrl
                ? o.androidStoreUrl
                : DEFAULT_ANDROID,
    };
}

/** Fail open on network/RPC errors so offline users are not hard-blocked. */
export async function evaluateMinimumAppVersion(): Promise<MinimumVersionGateResult> {
    const { data, error } = await supabase.rpc('get_app_client_config');
    if (error) {
        console.warn('get_app_client_config failed:', error.message);
        return { status: 'unknown' };
    }

    const config = parseConfig(data);
    if (!config) return { status: 'unknown' };

    if (isAppVersionBelowMinimum(APP_VERSION, config.minSupportedVersion)) {
        return { status: 'update_required', config };
    }

    return { status: 'ok' };
}
