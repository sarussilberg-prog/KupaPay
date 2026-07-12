/**
 * Deep-link focus for GroupDetail feed rows (from Activity / notifications).
 */

import type { FeedItem } from '@cost-share/shared';

export type GroupDetailFocusFeedItem =
    | { kind: 'expense'; id: string }
    | { kind: 'settlement'; id: string }
    | { kind: 'message'; id: string }
    | { kind: 'consolidation_batch'; id: string };

export function feedItemMatchesFocus(
    item: FeedItem,
    focus: GroupDetailFocusFeedItem,
): boolean {
    if (focus.kind === 'expense') {
        return item.kind === 'expense' && item.expense.id === focus.id;
    }
    if (focus.kind === 'message') {
        return item.kind === 'message' && item.message.id === focus.id;
    }
    if (focus.kind === 'consolidation_batch') {
        return item.kind === 'consolidation_batch' && item.batch.id === focus.id;
    }
    return item.kind === 'settlement' && item.settlement.id === focus.id;
}

export function findFeedItemIndex(
    feed: FeedItem[],
    focus: GroupDetailFocusFeedItem,
): number {
    return feed.findIndex((item) => feedItemMatchesFocus(item, focus));
}

/** Stable key identifying a focus target, used to dedupe re-renders. */
export function focusItemKey(focus: GroupDetailFocusFeedItem): string {
    return `${focus.kind}:${focus.id}`;
}

/** Row key used by the GroupDetail feed list for a focus target. */
export function focusRowKey(focus: GroupDetailFocusFeedItem): string {
    if (focus.kind === 'expense') return `e:${focus.id}`;
    if (focus.kind === 'message') return `m:${focus.id}`;
    if (focus.kind === 'consolidation_batch') return `b:${focus.id}`;
    return `s:${focus.id}`;
}

/**
 * State for a single GroupDetail focus session, carried across renders.
 * `pendingKey` is the key currently being focused (null when idle); `consumed`
 * flips true once the scroll/highlight has been scheduled for that key.
 */
export interface FocusSessionState {
    pendingKey: string | null;
    consumed: boolean;
}

export const IDLE_FOCUS_SESSION: FocusSessionState = {
    pendingKey: null,
    consumed: false,
};

export interface FocusSessionDecision {
    state: FocusSessionState;
    /** Clear search & filters so the focused row can't be filtered out. */
    resetFilters: boolean;
    /** Schedule scroll + highlight for this row key (null = nothing to do). */
    highlightKey: string | null;
    /** Feed index of the row to scroll to (-1 when there is nothing to do). */
    highlightIndex: number;
    /**
     * After a highlight is scheduled, the screen must clear the `focusFeedItem`
     * route param. Without this, re-navigating to the SAME item leaves an
     * identical param + a `consumed` session, so the highlight never re-fires —
     * the bug where focusing an activity row only worked the first time.
     */
    clearParam: boolean;
}

/**
 * Pure transition for the GroupDetail focus-param lifecycle. Called whenever the
 * focus param, feed contents, or loading state may have changed.
 *
 * - A new key starts a session and resets filters.
 * - Once the feed is ready and the row exists, it returns the row key to
 *   highlight, marks the session consumed, and asks the screen to clear the
 *   param so the same item can be focused again on a later navigation.
 * - A cleared/absent param returns the session to idle.
 */
export function reduceFocusSession(
    prev: FocusSessionState,
    focus: GroupDetailFocusFeedItem | null | undefined,
    feed: FeedItem[],
    isFeedLoading: boolean,
): FocusSessionDecision {
    if (!focus) {
        return { state: IDLE_FOCUS_SESSION, resetFilters: false, highlightKey: null, highlightIndex: -1, clearParam: false };
    }

    const key = focusItemKey(focus);
    const isNewSession = prev.pendingKey !== key;
    const state: FocusSessionState = isNewSession ? { pendingKey: key, consumed: false } : prev;
    const resetFilters = isNewSession;

    if (state.consumed || isFeedLoading) {
        return { state, resetFilters, highlightKey: null, highlightIndex: -1, clearParam: false };
    }

    const index = findFeedItemIndex(feed, focus);
    if (index < 0) {
        return { state, resetFilters, highlightKey: null, highlightIndex: -1, clearParam: false };
    }

    return {
        state: { pendingKey: key, consumed: true },
        resetFilters,
        highlightKey: focusRowKey(focus),
        highlightIndex: index,
        clearParam: true,
    };
}
