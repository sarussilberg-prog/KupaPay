import type { useAppStore } from '../store';

type PendingNavigation = ReturnType<typeof useAppStore.getState>['pendingNavigation'];

export interface NotificationData {
    kind?: string;
    groupId?: string | null;
    refId?: string | null;
    activityEventId?: string | null;
}

export function notificationDataToPendingNavigation(data: NotificationData): PendingNavigation {
    const { kind, groupId } = data ?? {};
    switch (kind) {
        case 'expense_added':
        case 'settlement_added':
        case 'consolidation_batch_added':
        case 'message_posted':
        case 'group_added':
        case 'group_member_joined':
            return groupId ? { target: 'groupDetail', groupId } : null;
        case 'friend_request_received':
            return { target: 'friends' };
        case 'group_removed':
            return { target: 'groupsList' };
        case 'settle_up_reminder':
            return groupId ? { target: 'settleUpList', groupId } : null;
        default:
            return null;
    }
}
