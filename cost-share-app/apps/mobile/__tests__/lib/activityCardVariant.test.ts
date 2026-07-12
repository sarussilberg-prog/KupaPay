import {
    getActivityCardVariant,
    activityCardAmountClassForNet,
} from '../../lib/activityCardVariant';

describe('getActivityCardVariant', () => {
    it('uses distinct icons per activity kind', () => {
        const expense = getActivityCardVariant('expense_added');
        const settlement = getActivityCardVariant('settlement_added');
        const message = getActivityCardVariant('message_posted');
        const friend = getActivityCardVariant('friend_request_received');

        expect(expense.iconName).toBe('receipt-outline');
        expect(settlement.iconName).toBe('swap-horizontal-outline');
        expect(message.iconName).toBe('chatbubble-outline');
        expect(friend.iconName).toBe('person-add-outline');
        expect(expense.showAmount).toBe(true);
        expect(settlement.showAmount).toBe(true);
        expect(message.showAmount).toBe(false);
        expect(friend.showAmount).toBe(false);
    });

    it('uses pending styling for pending friend requests', () => {
        const pending = getActivityCardVariant('friend_request_received', 'pending');
        expect(pending.iconName).toBe('person-add-outline');
        expect(pending.borderColor).toBe('#fde68a');
    });

    it('uses accepted styling with the shared amber border for accepted friend requests', () => {
        const accepted = getActivityCardVariant('friend_request_received', 'accepted');
        expect(accepted.iconName).toBe('checkmark-circle-outline');
        expect(accepted.borderColor).toBe('#fde68a');
    });

    it('uses rejected styling for rejected friend requests', () => {
        const rejected = getActivityCardVariant('friend_request_received', 'rejected');
        expect(rejected.iconName).toBe('close-circle-outline');
        expect(rejected.showAmount).toBe(false);
    });

    it('maps group_added to the group invite variant', () => {
        const variant = getActivityCardVariant('group_added');
        expect(variant.iconName).toBe('people-outline');
        expect(variant.showAmount).toBe(false);
    });

    it('maps group_member_joined to the member joined variant', () => {
        const variant = getActivityCardVariant('group_member_joined');
        expect(variant.iconName).toBe('enter-outline');
        expect(variant.showAmount).toBe(false);
    });

    it('maps group_removed to the member left variant', () => {
        const variant = getActivityCardVariant('group_removed');
        expect(variant.iconName).toBe('exit-outline');
        expect(variant.showAmount).toBe(false);
    });
});

describe('activityCardAmountClassForNet', () => {
    it('colors a positive viewer net green', () => {
        expect(activityCardAmountClassForNet(20)).toBe('text-green-600');
    });

    it('colors a negative viewer net red', () => {
        expect(activityCardAmountClassForNet(-20)).toBe('text-red-500');
    });

    it('colors a zero / uninvolved viewer net black', () => {
        expect(activityCardAmountClassForNet(0)).toBe('text-gray-900');
    });
});
