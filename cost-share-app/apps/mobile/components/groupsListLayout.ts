/** Responsive metrics for the groups list header and summary card. */

const GROUPS_LIST_HORIZONTAL_INSET = 16;
const GROUPS_LIST_ROUND_BUTTON_SIZE = 40;
const GROUPS_LIST_HEADER_ACTION_GAP = 8;
/** Rough width for a fully labelled create pill (longest locales). */
const GROUPS_LIST_CREATE_PILL_LABEL_WIDTH = 132;
const GROUPS_LIST_INLINE_TITLE_MIN_WIDTH = 108;

export const GROUPS_LIST_SUMMARY_AMOUNT_MIN_FONT_SCALE = 0.62;

/** Title on its own row so it is never truncated beside action buttons. */
export function resolveGroupsListUsesStackedHeader(windowWidth: number): boolean {
    return windowWidth <= 392;
}

/** Labelled create pill, or icon-only when inline row cannot fit the full label. */
export function resolveGroupsListCreateShowsLabel(windowWidth: number): boolean {
    if (resolveGroupsListUsesStackedHeader(windowWidth)) {
        return true;
    }
    const rowWidth = windowWidth - GROUPS_LIST_HORIZONTAL_INSET * 2;
    const trailingActions =
        GROUPS_LIST_ROUND_BUTTON_SIZE * 2 +
        GROUPS_LIST_HEADER_ACTION_GAP * 2 +
        GROUPS_LIST_CREATE_PILL_LABEL_WIDTH;
    return rowWidth - trailingActions >= GROUPS_LIST_INLINE_TITLE_MIN_WIDTH;
}
