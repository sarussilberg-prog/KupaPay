import type { ActivityEventKind } from '../types';

export type PushPlatform = 'ios' | 'android';

export type ActivityCategory = 'expenses' | 'settlements' | 'messages' | 'friends' | 'groups';

export interface NotificationPreferences {
    pushEnabled: boolean;
    expensesPush: boolean;
    settlementsPush: boolean;
    messagesPush: boolean;
    friendsPush: boolean;
    groupsPush: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
    pushEnabled: true,
    expensesPush: true,
    settlementsPush: true,
    messagesPush: true,
    friendsPush: true,
    groupsPush: true,
};

export const KIND_TO_CATEGORY: Record<ActivityEventKind, ActivityCategory> = {
    expense_added: 'expenses',
    settlement_added: 'settlements',
    message_posted: 'messages',
    friend_request_received: 'friends',
    group_added: 'groups',
    group_member_joined: 'groups',
    group_removed: 'groups',
};

export const CATEGORY_TO_PREF_KEY: Record<ActivityCategory, keyof NotificationPreferences> = {
    expenses: 'expensesPush',
    settlements: 'settlementsPush',
    messages: 'messagesPush',
    friends: 'friendsPush',
    groups: 'groupsPush',
};
