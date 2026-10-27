import type { ActivityEventKind } from '../types';

export type PushPlatform = 'ios' | 'android' | 'web';

export type ActivityCategory = 'expenses' | 'settlements' | 'messages' | 'friends' | 'groups' | 'reminders';

export interface NotificationPreferences {
    pushEnabled: boolean;
    expensesPush: boolean;
    settlementsPush: boolean;
    messagesPush: boolean;
    friendsPush: boolean;
    groupsPush: boolean;
    /** Automatic balance / settle-up nudges (#402). */
    remindersPush: boolean;
    quietHoursEnabled: boolean;
    /** Local hour 0–23 when quiet period starts. */
    quietHoursStart: number;
    /** Local hour 0–23 when quiet period ends (exclusive). */
    quietHoursEnd: number;
    /** IANA timezone, e.g. Asia/Jerusalem. */
    timezone: string;
    /** Max push notifications per rolling 24h (server-enforced). */
    dailyPushCap: number;
    /** Days with an open balance before a retention nudge. */
    unsettledNudgeAfterDays: number;
    /** Master switch for lifecycle / digest email (#404). */
    emailEnabled: boolean;
    /** Welcome, activation, and win-back email (#404). */
    lifecycleEmailEnabled: boolean;
    weeklyDigestPush: boolean;
    weeklyDigestEmail: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
    pushEnabled: true,
    expensesPush: true,
    settlementsPush: true,
    messagesPush: true,
    friendsPush: true,
    groupsPush: true,
    remindersPush: true,
    quietHoursEnabled: true,
    quietHoursStart: 22,
    quietHoursEnd: 8,
    timezone: 'UTC',
    dailyPushCap: 8,
    unsettledNudgeAfterDays: 7,
    emailEnabled: true,
    lifecycleEmailEnabled: true,
    weeklyDigestPush: true,
    weeklyDigestEmail: true,
};

export const KIND_TO_CATEGORY: Record<ActivityEventKind, ActivityCategory> = {
    expense_added: 'expenses',
    settlement_added: 'settlements',
    consolidation_batch_added: 'settlements',
    message_posted: 'messages',
    friend_request_received: 'friends',
    group_added: 'groups',
    group_member_joined: 'groups',
    group_removed: 'groups',
    group_created: 'groups',
    group_deleted: 'groups',
    group_note_changed: 'groups',
    settle_up_reminder: 'settlements',
    unsettled_balance_nudge: 'reminders',
    pro_trial_lifecycle_nudge: 'reminders',
    trip_budget_alert: 'groups',
};

export const CATEGORY_TO_PREF_KEY: Record<ActivityCategory, keyof NotificationPreferences> = {
    expenses: 'expensesPush',
    settlements: 'settlementsPush',
    messages: 'messagesPush',
    friends: 'friendsPush',
    groups: 'groupsPush',
    reminders: 'remindersPush',
};
