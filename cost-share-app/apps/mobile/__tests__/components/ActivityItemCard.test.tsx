import React from 'react';
import { render } from '@testing-library/react-native';
import {
    ActivityItemCard,
    resolveActivityTitle,
} from '../../components/ActivityItemCard';
import type { ActivityEvent, ActivityEventKind } from '@cost-share/shared';

function buildEvent(
    kind: ActivityEventKind,
    overrides: Partial<ActivityEvent> = {},
): ActivityEvent {
    const base: ActivityEvent = {
        id: `evt-${kind}`,
        userId: 'u-recipient',
        kind,
        groupId: 'g-1',
        refId: 'src-1',
        actorUserId: 'u-actor',
        metadata: {},
        createdAt: new Date('2026-05-26T12:00:00Z'),
    };
    return {
        ...base,
        ...overrides,
        metadata: { ...(base.metadata ?? {}), ...(overrides.metadata ?? {}) },
    };
}

const t = (key: string, opts?: Record<string, string>) => {
    if (key === 'activity.notifications.friendRequest') {
        return `Friend request from ${opts?.name}`;
    }
    if (key === 'activity.notifications.friendRequestAccepted') {
        return `Friends with ${opts?.name}`;
    }
    if (key === 'activity.notifications.friendRequestRejected') {
        return `Rejected ${opts?.name}`;
    }
    if (key === 'activity.notifications.groupInvite') {
        return `${opts?.name} added you to ${opts?.group}`;
    }
    if (key === 'activity.notifications.memberJoined') {
        return `${opts?.name} joined ${opts?.group}`;
    }
    if (key === 'activity.notifications.memberAddedByYou') {
        return `You added ${opts?.name}`;
    }
    if (key === 'activity.notifications.memberLeft') {
        return `${opts?.name} left ${opts?.group}`;
    }
    if (key === 'activity.notifications.memberRemovedYou') {
        return `${opts?.name} removed you from ${opts?.group}`;
    }
    if (key === 'activity.notifications.joinedViaInvite') {
        return `You joined ${opts?.group} using an invitation link`;
    }
    if (key === 'activity.notifications.groupCreatedByYou') {
        return `Group ${opts?.group} created by you`;
    }
    if (key === 'activity.notifications.groupDeletedByYou') {
        return `Group ${opts?.group} deleted by you`;
    }
    if (key === 'activity.notifications.groupDeletedBy') {
        return `Group ${opts?.group} deleted by ${opts?.name}`;
    }
    if (key === 'activity.notifications.noteChangedByYou') {
        return `Note changed by you · ${opts?.group}`;
    }
    if (key === 'activity.notifications.noteChangedBy') {
        return `Note changed by ${opts?.name} · ${opts?.group}`;
    }
    if (key === 'activity.notifications.friendRequestRejectedByThem') {
        return `${opts?.name} declined your friend request`;
    }
    if (key === 'common.you') return 'You';
    return key;
};

describe('resolveActivityTitle', () => {
    it('returns the expense description from metadata', () => {
        const title = resolveActivityTitle(
            buildEvent('expense_added', { metadata: { description: 'Lunch' } }),
            { actorName: 'Alice', groupName: 'Trip' },
            t as never,
        );
        expect(title).toBe('Lunch');
    });

    it('returns the message body from metadata for messages', () => {
        const title = resolveActivityTitle(
            buildEvent('message_posted', { metadata: { body: 'Hello' } }),
            { actorName: 'Alice', groupName: 'Trip' },
            t as never,
        );
        expect(title).toBe('Hello');
    });

    it('builds notification copy for pending friend requests', () => {
        const title = resolveActivityTitle(
            buildEvent('friend_request_received', { metadata: { status: 'pending' } }),
            { actorName: 'Alice', groupName: '' },
            t as never,
        );
        expect(title).toBe('Friend request from Alice');
    });

    it('builds accepted friend request copy', () => {
        const title = resolveActivityTitle(
            buildEvent('friend_request_received', { metadata: { status: 'accepted' } }),
            { actorName: 'Alice', groupName: '' },
            t as never,
        );
        expect(title).toBe('Friends with Alice');
    });

    it('builds rejected friend request copy (rejecter sees "you declined")', () => {
        const title = resolveActivityTitle(
            buildEvent('friend_request_received', {
                userId: 'u-me',
                metadata: { status: 'rejected', responder_user_id: 'u-me' },
            }),
            { actorName: 'Alice', groupName: '', currentUserId: 'u-me' },
            t as never,
        );
        expect(title).toBe('Rejected Alice');
    });

    it('builds group invite copy', () => {
        const title = resolveActivityTitle(
            buildEvent('group_added'),
            { actorName: 'Alice', groupName: 'Trip' },
            t as never,
        );
        expect(title).toBe('Alice added you to Trip');
    });

    it('builds invite-link self-join copy when there is no actor', () => {
        const title = resolveActivityTitle(
            buildEvent('group_added', { actorUserId: null }),
            { actorName: '', groupName: 'Trip' },
            t as never,
        );
        expect(title).toBe('You joined Trip using an invitation link');
    });

    it('uses the new member name when supplied for joins', () => {
        const title = resolveActivityTitle(
            buildEvent('group_member_joined'),
            { actorName: 'Alice', groupName: 'Trip', newMemberName: 'Bob' },
            t as never,
        );
        expect(title).toBe('Bob joined Trip');
    });

    it('renders "You added X" when the viewer is the one who added the member', () => {
        const title = resolveActivityTitle(
            buildEvent('group_member_joined', {
                userId: 'u-me',
                metadata: { added_by_user_id: 'u-me' },
            }),
            { actorName: 'Alice', groupName: 'Trip', newMemberName: 'Bob', currentUserId: 'u-me' },
            t as never,
        );
        expect(title).toBe('You added Bob');
    });

    it('keeps "X joined" when someone else added the member', () => {
        const title = resolveActivityTitle(
            buildEvent('group_member_joined', {
                metadata: { added_by_user_id: 'u-other' },
            }),
            { actorName: 'Alice', groupName: 'Trip', newMemberName: 'Bob', currentUserId: 'u-me' },
            t as never,
        );
        expect(title).toBe('Bob joined Trip');
    });

    it('names the remover when a member was removed by someone else', () => {
        const title = resolveActivityTitle(
            buildEvent('group_removed'),
            { actorName: 'Alice', groupName: 'Trip' },
            t as never,
        );
        expect(title).toBe('Alice removed you from Trip');
    });

    it('falls back to "You left" when there is no actor (self-leave)', () => {
        const title = resolveActivityTitle(
            buildEvent('group_removed', { actorUserId: null }),
            { actorName: '', groupName: 'Trip' },
            t as never,
        );
        expect(title).toBe('You left Trip');
    });
});

describe('resolveActivityTitle — group + friend events', () => {
    it('group_created → created-by-you', () => {
        const title = resolveActivityTitle(
            buildEvent('group_created', { actorUserId: 'me', userId: 'me' }),
            { actorName: 'Me', groupName: 'Trip', currentUserId: 'me' },
            t as never,
        );
        expect(title).toBe('Group Trip created by you');
    });

    it('group_deleted by someone else → deleted-by name', () => {
        const title = resolveActivityTitle(
            buildEvent('group_deleted', { actorUserId: 'u2', userId: 'me' }),
            { actorName: 'Alice', groupName: 'Trip', currentUserId: 'me' },
            t as never,
        );
        expect(title).toBe('Group Trip deleted by Alice');
    });

    it('group_deleted by you → deleted-by-you', () => {
        const title = resolveActivityTitle(
            buildEvent('group_deleted', { actorUserId: 'me', userId: 'me' }),
            { actorName: 'Me', groupName: 'Trip', currentUserId: 'me' },
            t as never,
        );
        expect(title).toBe('Group Trip deleted by you');
    });

    it('group_note_changed by someone else → note-changed-by name', () => {
        const title = resolveActivityTitle(
            buildEvent('group_note_changed', { actorUserId: 'u2', userId: 'me' }),
            { actorName: 'Alice', groupName: 'Trip', currentUserId: 'me' },
            t as never,
        );
        expect(title).toBe('Note changed by Alice · Trip');
    });

    it('friend reject — rejecter sees "you declined"', () => {
        const title = resolveActivityTitle(
            buildEvent('friend_request_received', {
                actorUserId: 'u2',
                userId: 'me',
                metadata: { status: 'rejected', responder_user_id: 'me' },
            }),
            { actorName: 'Bob', groupName: '', currentUserId: 'me' },
            t as never,
        );
        expect(title).toBe('Rejected Bob');
    });

    it('friend reject — sender sees "{name} declined your request"', () => {
        const title = resolveActivityTitle(
            buildEvent('friend_request_received', {
                actorUserId: 'u2',
                userId: 'me',
                metadata: { status: 'rejected', responder_user_id: 'u2' },
            }),
            { actorName: 'Bob', groupName: '', currentUserId: 'me' },
            t as never,
        );
        expect(title).toBe('Bob declined your friend request');
    });
});

describe('ActivityItemCard', () => {
    it('renders group name on its own line and amount for expenses', () => {
        const { getByText, getByTestId } = render(
            <ActivityItemCard
                event={buildEvent('expense_added', {
                    metadata: { description: 'Coffee', amount: 5.5, currency: 'USD' },
                })}
                title="Coffee"
                meta="Alice · now"
                groupName="Trip"
                testID="card"
            />,
        );
        expect(getByText('Trip')).toBeTruthy();
        expect(getByText(/\$5\.50/)).toBeTruthy();
        expect(getByTestId('activity-card-amount')).toBeTruthy();
    });

    it('renders amount for settlements', () => {
        const { getByTestId } = render(
            <ActivityItemCard
                event={buildEvent('settlement_added', {
                    metadata: { amount: 20, currency: 'USD' },
                })}
                title="You paid Bob"
                meta="now"
                testID="card"
            />,
        );
        expect(getByTestId('activity-card-amount')).toBeTruthy();
    });

    it('omits amount for messages', () => {
        const { queryByTestId } = render(
            <ActivityItemCard
                event={buildEvent('message_posted', {
                    metadata: { body: 'Hello' },
                })}
                title="Hello"
                meta="Alice · now"
                testID="card"
            />,
        );
        expect(queryByTestId('activity-card-amount')).toBeNull();
    });

    it('omits amount for friend requests', () => {
        const { queryByTestId } = render(
            <ActivityItemCard
                event={buildEvent('friend_request_received', {
                    metadata: { status: 'pending' },
                })}
                friendRequestStatus="pending"
                title="Friend request from Alice"
                meta="now"
                testID="card"
            />,
        );
        expect(queryByTestId('activity-card-amount')).toBeNull();
    });

    it('omits amount for group_added', () => {
        const { queryByTestId } = render(
            <ActivityItemCard
                event={buildEvent('group_added')}
                title="Alice added you"
                meta="now"
                testID="card"
            />,
        );
        expect(queryByTestId('activity-card-amount')).toBeNull();
    });

    it('omits amount for group_member_joined', () => {
        const { queryByTestId } = render(
            <ActivityItemCard
                event={buildEvent('group_member_joined')}
                title="Bob joined"
                meta="now"
                testID="card"
            />,
        );
        expect(queryByTestId('activity-card-amount')).toBeNull();
    });

    it('omits amount for group_removed', () => {
        const { queryByTestId } = render(
            <ActivityItemCard
                event={buildEvent('group_removed')}
                title="Alice left"
                meta="now"
                testID="card"
            />,
        );
        expect(queryByTestId('activity-card-amount')).toBeNull();
    });
});
