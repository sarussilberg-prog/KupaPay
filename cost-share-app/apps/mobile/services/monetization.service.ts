import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../lib/auth';

type MonetizationEventType =
    | 'ad_gate_shown'
    | 'ad_gate_watch_tapped'
    | 'ad_gate_watch_completed'
    | 'ad_gate_pro_tapped'
    | 'pro_promo_dismissed'
    | 'remind_sent'
    | 'paywall_viewed'
    | 'purchase_started'
    | 'purchase_completed'
    | 'purchase_failed'
    | 'restore_completed'
    | 'restore_failed';

export async function logMonetizationEvent(
    featureKey: string,
    eventType: MonetizationEventType,
): Promise<void> {
    const userId = await getCurrentUserId();
    if (!userId) return;
    await supabase.from('monetization_events').insert({
        user_id: userId,
        feature_key: featureKey,
        event_type: eventType,
        platform: Platform.OS,
    });
}
