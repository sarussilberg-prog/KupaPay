import { supabase } from '../lib/supabase';
import type { SmartReminderIntervalDays } from '../lib/smartPaymentReminder';
import { showErrorToast, showSuccessMessage } from '../lib/appToast';

export async function setGroupSmartReminderInterval(
    groupId: string,
    intervalDays: SmartReminderIntervalDays,
): Promise<boolean> {
    const { error } = await supabase.rpc('set_group_smart_reminder', {
        p_group_id: groupId,
        p_interval_days: intervalDays,
    });
    if (error) {
        if (error.message.includes('pro_required')) {
            showErrorToast('pro.smartReminder.proRequired');
        } else {
            showErrorToast('common.errorGeneric');
        }
        return false;
    }
    showSuccessMessage('pro.smartReminder.saved');
    return true;
}

export async function fetchGroupSmartReminderInterval(
    groupId: string,
): Promise<SmartReminderIntervalDays> {
    const { data, error } = await supabase
        .from('groups')
        .select('smart_reminder_interval_days')
        .eq('id', groupId)
        .maybeSingle();
    if (error || data?.smart_reminder_interval_days == null) return null;
    const n = Number(data.smart_reminder_interval_days);
    if (n === 3 || n === 7 || n === 14) return n;
    return null;
}
