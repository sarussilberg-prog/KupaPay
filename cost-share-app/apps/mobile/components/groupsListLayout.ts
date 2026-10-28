/** Responsive metrics for the groups list header and summary card. */

export const GROUPS_LIST_HORIZONTAL_INSET = 16;
export const GROUPS_LIST_ROUND_BUTTON_SIZE = 40;
export const GROUPS_LIST_HEADER_ACTION_GAP = 8;
export const GROUPS_LIST_TITLE_MIN_WIDTH = 88;
export const GROUPS_LIST_CREATE_PILL_MIN_WIDTH = 72;
export const GROUPS_LIST_CREATE_PILL_MAX_WIDTH = 150;

export function resolveGroupsListHeaderRowWidth(windowWidth: number): number {
    return windowWidth - GROUPS_LIST_HORIZONTAL_INSET * 2;
}

/** Max width for the labelled “Create group” pill so the title keeps readable space. */
export function resolveGroupsListCreatePillMaxWidth(windowWidth: number): number {
    const rowWidth = resolveGroupsListHeaderRowWidth(windowWidth);
    const trailingActions =
        GROUPS_LIST_ROUND_BUTTON_SIZE * 2 +
        GROUPS_LIST_HEADER_ACTION_GAP * 3;
    const available = rowWidth - trailingActions - GROUPS_LIST_TITLE_MIN_WIDTH;
    return Math.min(
        GROUPS_LIST_CREATE_PILL_MAX_WIDTH,
        Math.max(GROUPS_LIST_CREATE_PILL_MIN_WIDTH, Math.floor(available)),
    );
}

export const GROUPS_LIST_SUMMARY_AMOUNT_MIN_FONT_SCALE = 0.62;
