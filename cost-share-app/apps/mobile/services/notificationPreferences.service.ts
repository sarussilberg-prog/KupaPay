import { supabase } from '../lib/supabase';
import { DEFAULT_NOTIFICATION_PREFERENCES, type NotificationPreferences } from '@cost-share/shared';

interface PrefsRow {
    push_enabled: boolean;
    expenses_push: boolean;
    settlements_push: boolean;
    messages_push: boolean;
    friends_push: boolean;
    groups_push: boolean;
}

function rowToPrefs(row: PrefsRow): NotificationPreferences {
    return {
        pushEnabled: row.push_enabled,
        expensesPush: row.expenses_push,
        settlementsPush: row.settlements_push,
        messagesPush: row.messages_push,
        friendsPush: row.friends_push,
        groupsPush: row.groups_push,
    };
}

export async function fetchNotificationPreferences(userId: string): Promise<NotificationPreferences> {
    const { data, error } = await supabase
        .from('notification_preferences')
        .select('push_enabled, expenses_push, settlements_push, messages_push, friends_push, groups_push')
        .eq('user_id', userId)
        .maybeSingle();
    if (error || !data) return DEFAULT_NOTIFICATION_PREFERENCES;
    return rowToPrefs(data as PrefsRow);
}

export async function saveNotificationPreferences(prefs: NotificationPreferences): Promise<void> {
    const { error } = await supabase.rpc('update_notification_preferences', {
        p_prefs: {
            push_enabled: prefs.pushEnabled,
            expenses_push: prefs.expensesPush,
            settlements_push: prefs.settlementsPush,
            messages_push: prefs.messagesPush,
            friends_push: prefs.friendsPush,
            groups_push: prefs.groupsPush,
        },
    });
    if (error) throw error;
}
