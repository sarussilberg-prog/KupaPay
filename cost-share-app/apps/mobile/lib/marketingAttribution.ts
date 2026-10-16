import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import {
    marketingAttributionToPostHogProperties,
    mergeMarketingAttribution,
    parseMarketingAttributionFromUrl,
    type MarketingAttribution,
} from '@cost-share/shared';
import { getProductAnalyticsClient } from './productAnalytics';

const STORAGE_KEY = '@kupapay/marketing_attribution_v1';

export async function loadStoredMarketingAttribution(): Promise<MarketingAttribution | null> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as MarketingAttribution;
    } catch {
        return null;
    }
}

async function persistMarketingAttribution(attr: MarketingAttribution): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(attr));
}

function attributionFromWebLocation(): MarketingAttribution | null {
    if (Platform.OS !== 'web' || typeof globalThis.location === 'undefined') return null;
    return parseMarketingAttributionFromUrl(globalThis.location.href);
}

function withPlatformReferrer(
    attr: MarketingAttribution,
    installReferrer?: string,
): MarketingAttribution {
    if (!installReferrer?.trim()) return attr;
    return { ...attr, installReferrer: installReferrer.trim().slice(0, 200) };
}

/** Capture first-touch UTM / campaign params and register on PostHog (#424). */
export async function captureMarketingAttributionFromLaunchUrls(
    initialUrl?: string | null,
): Promise<MarketingAttribution | null> {
    const existing = await loadStoredMarketingAttribution();
    const candidates: MarketingAttribution[] = [];

    const web = attributionFromWebLocation();
    if (web) candidates.push(web);

    if (initialUrl) {
        const fromInitial = parseMarketingAttributionFromUrl(initialUrl);
        if (fromInitial) candidates.push(fromInitial);
    }

    if (Platform.OS === 'android' && initialUrl) {
        const parsed = parseMarketingAttributionFromUrl(initialUrl);
        if (parsed) {
            candidates.push(
                withPlatformReferrer(parsed, 'play_store_deferred_link'),
            );
        }
    }

    if (Platform.OS === 'ios' && initialUrl) {
        const parsed = parseMarketingAttributionFromUrl(initialUrl);
        if (parsed?.appleSearchAdsCampaign) {
            candidates.push(parsed);
        }
    }

    let merged = existing;
    for (const c of candidates) {
        merged = mergeMarketingAttribution(merged, c);
    }
    if (!merged) return null;

    if (!existing) {
        await persistMarketingAttribution(merged);
    }

    return merged;
}

export async function applyStoredMarketingAttributionToPostHog(userId: string): Promise<void> {
    const stored = await loadStoredMarketingAttribution();
    if (!stored) return;
    const client = getProductAnalyticsClient();
    if (!client) return;
    try {
        client.identify(userId, marketingAttributionToPostHogProperties(stored));
    } catch {
        // ignore
    }
}

export async function bootstrapMarketingAttribution(): Promise<void> {
    const initial = await Linking.getInitialURL();
    await captureMarketingAttributionFromLaunchUrls(initial);
}
