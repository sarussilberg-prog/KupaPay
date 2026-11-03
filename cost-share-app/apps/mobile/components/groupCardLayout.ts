import type { ViewStyle } from 'react-native';
import { spacing } from '../theme';

/** Shared 8pt-grid metrics for groups list cards (iOS / Android / web). */
export const GROUP_CARD_PAD = 12;
/** Horizontal gap between avatar, text, balance pill, and menu (~12pt). */
export const GROUP_CARD_ROW_GAP = spacing.md;
export const GROUP_CARD_TEXT_GAP = 2;
export const GROUP_CARD_MENU_HIT = 40;
export const GROUP_CARD_MENU_ICON = 18;
export const GROUP_CARD_AVATAR_WIDTH = 40;
export { GROUP_CARD_MAX_SHELL_HEIGHT } from '../lib/groupsCardLayoutLimits';
const GROUP_CARD_LIST_HORIZONTAL_INSET = 16;
/** Minimum width reserved for title + meta in inline layout. */
const GROUP_CARD_TEXT_MIN_WIDTH = 88;
/** Lower bound for chip width — content-sized below this. */
export const GROUP_CARD_CHIP_MIN_WIDTH = 64;
/** Upper bound for compact list chip width. */
export const GROUP_CARD_CHIP_MAX_WIDTH = 104;

function groupCardInlineRowInnerWidth(windowWidth: number): number {
    const listContentWidth = windowWidth - GROUP_CARD_LIST_HORIZONTAL_INSET * 2;
    return (
        listContentWidth -
        GROUP_CARD_PAD * 2 -
        GROUP_CARD_AVATAR_WIDTH -
        GROUP_CARD_ROW_GAP * 3 -
        GROUP_CARD_MENU_HIT
    );
}

/** Compact cards always keep balance inline in one row (no stacked chip). */
export function resolveGroupCardUsesStackedBalance(_windowWidth: number): boolean {
    return false;
}

/** Trailing balance column width scales with remaining row space. */
export function resolveGroupCardBalanceColumnWidth(windowWidth: number): number {
    const rowInner = groupCardInlineRowInnerWidth(windowWidth);
    const reservedForTextAndAvatar =
        GROUP_CARD_AVATAR_WIDTH + GROUP_CARD_ROW_GAP * 2 + GROUP_CARD_TEXT_MIN_WIDTH;
    const available = rowInner - reservedForTextAndAvatar;
    return Math.min(
        GROUP_CARD_CHIP_MAX_WIDTH,
        Math.max(GROUP_CARD_CHIP_MIN_WIDTH, Math.floor(available)),
    );
}

/** Trailing balance column on list rows — compact chip, vertically centered with row. */
export function groupCardBalanceColumnStyle(windowWidth: number) {
    return {
        flexShrink: 0 as const,
        flexGrow: 0 as const,
        width: resolveGroupCardBalanceColumnWidth(windowWidth),
        maxWidth: GROUP_CARD_CHIP_MAX_WIDTH,
        minWidth: GROUP_CARD_CHIP_MIN_WIDTH,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
    };
}

/** Title + meta column — grows between avatar and balance; content hugs the start (icon) edge. */
export function groupCardTextColumnStyle(_isRtl: boolean): ViewStyle {
    return {
        flex: 1,
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 0,
        minWidth: 0,
        alignSelf: 'stretch',
        gap: GROUP_CARD_TEXT_GAP,
        justifyContent: 'center',
        alignItems: 'flex-start',
    };
}
