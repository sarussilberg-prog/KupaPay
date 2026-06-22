import {
    findFeedItemIndex,
    IDLE_FOCUS_SESSION,
    reduceFocusSession,
    type GroupDetailFocusFeedItem,
} from '../../lib/groupDetailFocus';
import type { FeedItem } from '@cost-share/shared';

const feed: FeedItem[] = [
    {
        kind: 'message',
        sortAt: new Date(),
        message: {
            id: 'm1',
            groupId: 'g1',
            userId: 'u1',
            body: 'hi',
            editedAt: null,
            isDeleted: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        },
    },
    {
        kind: 'expense',
        sortAt: new Date(),
        expense: {
            id: 'e1',
            groupId: 'g1',
            description: 'Lunch',
            amount: 10,
            currency: 'USD',
            category: 'food',
            expenseDate: new Date(),
            paidBy: 'u1',
            createdBy: 'u1',
            isDeleted: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            splits: [],
            myDelta: 0,
            myDeltaState: 'settled',
        },
    },
];

describe('findFeedItemIndex', () => {
    it('finds expense index in feed', () => {
        expect(findFeedItemIndex(feed, { kind: 'expense', id: 'e1' })).toBe(1);
    });

    it('finds message index in feed', () => {
        expect(findFeedItemIndex(feed, { kind: 'message', id: 'm1' })).toBe(0);
    });

    it('returns -1 when item is missing', () => {
        expect(findFeedItemIndex(feed, { kind: 'settlement', id: 's9' })).toBe(-1);
    });

    it('returns -1 for a missing message', () => {
        expect(findFeedItemIndex(feed, { kind: 'message', id: 'm9' })).toBe(-1);
    });
});

describe('reduceFocusSession', () => {
    const message: GroupDetailFocusFeedItem = { kind: 'message', id: 'm1' };
    const expense: GroupDetailFocusFeedItem = { kind: 'expense', id: 'e1' };

    it('does nothing when there is no focus param', () => {
        const d = reduceFocusSession(IDLE_FOCUS_SESSION, undefined, feed, false);
        expect(d.highlightKey).toBeNull();
        expect(d.resetFilters).toBe(false);
        expect(d.clearParam).toBe(false);
        expect(d.state).toEqual(IDLE_FOCUS_SESSION);
    });

    it('resets filters and waits while the feed is still loading', () => {
        const d = reduceFocusSession(IDLE_FOCUS_SESSION, message, feed, true);
        expect(d.resetFilters).toBe(true);
        expect(d.highlightKey).toBeNull();
        expect(d.clearParam).toBe(false);
        expect(d.state.pendingKey).toBe('message:m1');
        expect(d.state.consumed).toBe(false);
    });

    it('highlights the message row and asks to clear the param once the feed is ready', () => {
        const d = reduceFocusSession(IDLE_FOCUS_SESSION, message, feed, false);
        expect(d.highlightKey).toBe('m:m1');
        expect(d.clearParam).toBe(true);
        expect(d.state.consumed).toBe(true);
    });

    it('highlights expense and settlement rows with the right row-key prefix', () => {
        expect(reduceFocusSession(IDLE_FOCUS_SESSION, expense, feed, false).highlightKey).toBe('e:e1');
        const settlementFeed: FeedItem[] = [
            {
                kind: 'settlement',
                sortAt: new Date(),
                settlement: {
                    id: 's1',
                    groupId: 'g1',
                    fromUserId: 'u1',
                    toUserId: 'u2',
                    amount: 5,
                    currency: 'USD',
                    note: null,
                    settledAt: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    isDeleted: false,
                } as FeedItem extends { settlement: infer S } ? S : never,
            } as FeedItem,
        ];
        expect(
            reduceFocusSession(IDLE_FOCUS_SESSION, { kind: 'settlement', id: 's1' }, settlementFeed, false).highlightKey,
        ).toBe('s:s1');
    });

    it('does not re-highlight the same key on a re-render while the param persists', () => {
        const first = reduceFocusSession(IDLE_FOCUS_SESSION, message, feed, false);
        expect(first.highlightKey).toBe('m:m1');
        // Same param still present on a later render (e.g. filteredFeed changed):
        // it must not schedule a second highlight for the already-consumed key.
        const second = reduceFocusSession(first.state, message, feed, false);
        expect(second.highlightKey).toBeNull();
    });

    it('REGRESSION: re-focusing the same item after the param clears highlights again', () => {
        // 1. First navigation highlights and requests the param be cleared.
        const first = reduceFocusSession(IDLE_FOCUS_SESSION, message, feed, false);
        expect(first.highlightKey).toBe('m:m1');
        expect(first.clearParam).toBe(true);

        // 2. Screen clears the param -> next render sees no focus -> back to idle.
        const cleared = reduceFocusSession(first.state, undefined, feed, false);
        expect(cleared.state).toEqual(IDLE_FOCUS_SESSION);

        // 3. User taps the SAME activity again -> fresh navigation -> highlights again.
        const second = reduceFocusSession(cleared.state, message, feed, false);
        expect(second.highlightKey).toBe('m:m1');
    });
});
