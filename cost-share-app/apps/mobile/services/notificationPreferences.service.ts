import { supabase } from '../lib/supabase';
import { DEFAULT_NOTIFICATION_PREFERENCES, type NotificationPreferences } from '@cost-share/shared';

interface PrefsRow {
    push_enabled: boolean;
    expenses_push: boolean;
    settlements_push: boolean;
    messages_push: boolean;
    friends_push: boolean;
    groups_push: boolean;
    reminders_push: boolean;
    quiet_hours_enabled: boolean;
    quiet_hours_start: number;
    quiet_hours_end: number;
    timezone: string;
    daily_push_cap: number;
    unsettled_nudge_after_days: number;
    email_enabled: boolean;
    lifecycle_email_enabled: boolean;
    weekly_digest_push: boolean;
    weekly_digest_email: boolean;
}

function rowToPrefs(row: PrefsRow): NotificationPreferences {
    return {
        pushEnabled: row.push_enabled,
        expensesPush: row.expenses_push,
        settlementsPush: row.settlements_push,
        messagesPush: row.messages_push,
        friendsPush: row.friends_push,
        groupsPush: row.groups_push,
        remindersPush: row.reminders_push ?? true,
        quietHoursEnabled: row.quiet_hours_enabled ?? true,
        quietHoursStart: row.quiet_hours_start ?? DEFAULT_NOTIFICATION_PREFERENCES.quietHoursStart,
        quietHoursEnd: row.quiet_hours_end ?? DEFAULT_NOTIFICATION_PREFERENCES.quietHoursEnd,
        timezone: row.timezone ?? DEFAULT_NOTIFICATION_PREFERENCES.timezone,
        dailyPushCap: row.daily_push_cap ?? DEFAULT_NOTIFICATION_PREFERENCES.dailyPushCap,
        unsettledNudgeAfterDays: row.unsettled_nudge_after_days
            ?? DEFAULT_NOTIFICATION_PREFERENCES.unsettledNudgeAfterDays,
        emailEnabled: row.email_enabled ?? DEFAULT_NOTIFICATION_PREFERENCES.emailEnabled,
        lifecycleEmailEnabled: row.lifecycle_email_enabled
            ?? DEFAULT_NOTIFICATION_PREFERENCES.lifecycleEmailEnabled,
        weeklyDigestPush: row.weekly_digest_push ?? DEFAULT_NOTIFICATION_PREFERENCES.weeklyDigestPush,
        weeklyDigestEmail: row.weekly_digest_email ?? DEFAULT_NOTIFICATION_PREFERENCES.weeklyDigestEmail,
    };
}

export function deviceTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
    } catch {
        return 'UTC';
    }
}

export async function fetchNotificationPreferences(userId: string): Promise<NotificationPreferences> {
    const { data, error } = await supabase
        .from('notification_preferences')
        .select(`push_enabled, expenses_push, settlements_push, messages_push, friends_push, groups_push,
            reminders_push, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, timezone,
            daily_push_cap, unsettled_nudge_after_days, email_enabled, lifecycle_email_enabled,
            weekly_digest_push, weekly_digest_email`)
        .eq('user_id', userId)
        .maybeSingle();
    if (error || !data) return { ...DEFAULT_NOTIFICATION_PREFERENCES, timezone: deviceTimezone() };
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
            reminders_push: prefs.remindersPush,
            quiet_hours_enabled: prefs.quietHoursEnabled,
            quiet_hours_start: prefs.quietHoursStart,
            quiet_hours_end: prefs.quietHoursEnd,
            timezone: prefs.timezone || deviceTimezone(),
            daily_push_cap: prefs.dailyPushCap,
            unsettled_nudge_after_days: prefs.unsettledNudgeAfterDays,
            email_enabled: prefs.emailEnabled,
            lifecycle_email_enabled: prefs.lifecycleEmailEnabled,
            weekly_digest_push: prefs.weeklyDigestPush,
            weekly_digest_email: prefs.weeklyDigestEmail,
        },
    });
    if (error) throw error;
}
