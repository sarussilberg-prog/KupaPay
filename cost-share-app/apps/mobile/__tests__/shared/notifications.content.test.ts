import {
    KIND_TO_CATEGORY,
    CATEGORY_TO_PREF_KEY,
    DEFAULT_NOTIFICATION_PREFERENCES,
} from '@cost-share/shared/notifications';
import type { ActivityEventKind } from '@cost-share/shared';

describe('notification content mapping', () => {
    it('maps every activity kind to a category', () => {
        const kinds: ActivityEventKind[] = [
            'expense_added', 'settlement_added', 'message_posted',
            'friend_request_received', 'group_added', 'group_member_joined', 'group_removed',
        ];
        for (const k of kinds) {
            expect(KIND_TO_CATEGORY[k]).toBeDefined();
        }
        expect(KIND_TO_CATEGORY.expense_added).toBe('expenses');
        expect(KIND_TO_CATEGORY.settlement_added).toBe('settlements');
        expect(KIND_TO_CATEGORY.message_posted).toBe('messages');
        expect(KIND_TO_CATEGORY.friend_request_received).toBe('friends');
        expect(KIND_TO_CATEGORY.group_member_joined).toBe('groups');
    });

    it('maps every category to a preference key', () => {
        expect(CATEGORY_TO_PREF_KEY.expenses).toBe('expensesPush');
        expect(CATEGORY_TO_PREF_KEY.groups).toBe('groupsPush');
    });

    it('defaults all preferences to true', () => {
        expect(Object.values(DEFAULT_NOTIFICATION_PREFERENCES).every(Boolean)).toBe(true);
    });
});
