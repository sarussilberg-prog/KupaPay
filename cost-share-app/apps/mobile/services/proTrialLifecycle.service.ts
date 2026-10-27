import {
    dueProTrialLifecycleTouch,
    renderProTrialLifecyclePush,
    type ProTrialFeatureUsage,
    type ProTrialLifecycleTouchDay,
} from '@cost-share/shared';
import { supabase } from '../lib/supabase';

export async function markProTrialLifecycleTouchDismissed(day: ProTrialLifecycleTouchDay): Promise<void> {
    const { error } = await supabase.rpc('mark_pro_trial_lifecycle_sent', { p_day: day });
    if (error) throw error;
}

export async function registerProTrialFeatureUsage(usage: ProTrialFeatureUsage): Promise<void> {
    const { error } = await supabase.rpc('register_pro_trial_feature_usage', { p_usage: usage });
    if (error) throw error;
}

export function resolveInAppProTrialTouch(input: {
    trialEndsAtIso: string | null;
    lifecycleSent: number[];
    featureUsage: ProTrialFeatureUsage;
    language: string;
}): { day: ProTrialLifecycleTouchDay; title: string; body: string } | null {
    if (!input.trialEndsAtIso) return null;
    const trialEnd = new Date(input.trialEndsAtIso);
    if (Number.isNaN(trialEnd.getTime()) || trialEnd.getTime() <= Date.now()) return null;
    const trialStart = new Date(trialEnd.getTime() - 14 * 24 * 60 * 60 * 1000);
    const day = dueProTrialLifecycleTouch(trialStart, input.lifecycleSent);
    if (!day) return null;
    const copy = renderProTrialLifecyclePush(day, input.featureUsage, input.language);
    return { day, title: copy.title, body: copy.body };
}
