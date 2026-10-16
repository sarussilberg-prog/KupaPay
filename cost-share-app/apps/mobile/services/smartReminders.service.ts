import { supabase } from '../lib/supabase';

export async function setGroupSmartReminder(
    groupId: string,
    enabled: boolean,
    intervalDays: number,
): Promise<boolean> {
    const { error } = await supabase.rpc('set_group_smart_reminder', {
        p_group_id: groupId,
        p_enabled: enabled,
        p_interval_days: intervalDays,
    });
    return !error;
}

export async function fetchGroupSmartReminderSettings(groupId: string): Promise<{
    enabled: boolean;
    intervalDays: number | null;
} | null> {
    const { data, error } = await supabase
        .from('groups')
        .select('smart_reminder_enabled, smart_reminder_interval_days')
        .eq('id', groupId)
        .maybeSingle();
    if (error || !data) return null;
    return {
        enabled: Boolean(data.smart_reminder_enabled),
        intervalDays: data.smart_reminder_interval_days as number | null,
    };
}
