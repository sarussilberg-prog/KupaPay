/** Shared 8pt-grid metrics for groups list cards (iOS / Android / web). */
export const GROUP_CARD_PAD = 16;
export const GROUP_CARD_ROW_GAP = 12;
export const GROUP_CARD_TEXT_GAP = 4;
export const GROUP_CARD_STACK_GAP = 8;
export const GROUP_CARD_MENU_HIT = 44;
export const GROUP_CARD_MENU_ICON = 18;
const GROUP_CARD_LIST_HORIZONTAL_INSET = 16;
const GROUP_CARD_AVATAR_WIDTH = 48;
/** Minimum width reserved for title + meta in inline (side-by-side) layout. */
const GROUP_CARD_TEXT_MIN_WIDTH = 104;
/** Lower bound for chip width — content-sized below this. */
export const GROUP_CARD_CHIP_MIN_WIDTH = 76;
/** Upper bound for chip width — content-sized below this. */
export const GROUP_CARD_CHIP_MAX_WIDTH = 120;

function groupCardInlineRowInnerWidth(windowWidth: number): number {
    const listContentWidth = windowWidth - GROUP_CARD_LIST_HORIZONTAL_INSET * 2;
    return (
        listContentWidth -
        GROUP_CARD_PAD * 2 -
        GROUP_CARD_MENU_HIT -
        GROUP_CARD_STACK_GAP
    );
}

/** Stack balance chip under title when inline row cannot fit avatar + text + chip mins. */
export function resolveGroupCardUsesStackedBalance(windowWidth: number): boolean {
    const rowInner = groupCardInlineRowInnerWidth(windowWidth);
    const inlineMinimum =
        GROUP_CARD_AVATAR_WIDTH +
        GROUP_CARD_ROW_GAP * 2 +
        GROUP_CARD_TEXT_MIN_WIDTH +
        GROUP_CARD_CHIP_MIN_WIDTH;
    return rowInner < inlineMinimum;
}

/** Trailing balance column width (inline) or max chip width when stacked. */
export function resolveGroupCardBalanceColumnWidth(windowWidth: number): number {
    if (resolveGroupCardUsesStackedBalance(windowWidth)) {
        return GROUP_CARD_CHIP_MAX_WIDTH;
    }
    const rowInner = groupCardInlineRowInnerWidth(windowWidth);
    const reservedForTextAndAvatar =
        GROUP_CARD_AVATAR_WIDTH +
        GROUP_CARD_ROW_GAP * 2 +
        GROUP_CARD_TEXT_MIN_WIDTH;
    const available = rowInner - reservedForTextAndAvatar;
    return Math.min(
        GROUP_CARD_CHIP_MAX_WIDTH,
        Math.max(GROUP_CARD_CHIP_MIN_WIDTH, Math.floor(available)),
    );
}

/** Trailing balance column on wide list rows — width scales with screen; pills stay centered. */
export function groupCardBalanceColumnStyle(windowWidth: number) {
    return {
        flexShrink: 0 as const,
        flexGrow: 0 as const,
        width: resolveGroupCardBalanceColumnWidth(windowWidth),
        maxWidth: GROUP_CARD_CHIP_MAX_WIDTH,
        minWidth: GROUP_CARD_CHIP_MIN_WIDTH,
        alignItems: 'center' as const,
    };
}
