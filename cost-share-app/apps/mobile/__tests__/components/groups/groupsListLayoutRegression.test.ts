import {
    GROUPS_LIST_CREATE_PILL_MAX_WIDTH,
    GROUPS_LIST_CREATE_PILL_MIN_WIDTH,
    resolveGroupsListCreatePillMaxWidth,
} from '../../../components/groupsListLayout';
import {
    groupCardBalanceColumnStyle,
    resolveGroupCardUsesStackedBalance,
} from '../../../components/groupCardLayout';

const TARGET_WIDTHS = [320, 360, 375, 390, 430, 768] as const;

describe('groups list layout regression (#633 responsive)', () => {
    describe.each(TARGET_WIDTHS)('at %ipx width', width => {
        it('resolves create pill width within bounds', () => {
            const pill = resolveGroupsListCreatePillMaxWidth(width);
            expect(pill).toBeGreaterThanOrEqual(GROUPS_LIST_CREATE_PILL_MIN_WIDTH);
            expect(pill).toBeLessThanOrEqual(GROUPS_LIST_CREATE_PILL_MAX_WIDTH);
        });

        it('resolves balance column without zero width', () => {
            const column = groupCardBalanceColumnStyle(width);
            expect(column.width).toBeGreaterThan(0);
            expect(column.alignItems).toBe('center');
        });
    });

    it('documents stack vs inline breakpoints for QA widths', () => {
        expect(resolveGroupCardUsesStackedBalance(320)).toBe(true);
        expect(resolveGroupCardUsesStackedBalance(375)).toBe(false);
        expect(resolveGroupCardUsesStackedBalance(430)).toBe(false);
    });
});
