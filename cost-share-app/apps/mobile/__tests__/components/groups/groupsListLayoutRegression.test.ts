import {
    resolveGroupsListCreateShowsLabel,
    resolveGroupsListUsesStackedHeader,
} from '../../../components/groupsListLayout';
import {
    groupCardBalanceColumnStyle,
    resolveGroupCardUsesStackedBalance,
} from '../../../components/groupCardLayout';

const TARGET_WIDTHS = [320, 360, 375, 390, 430, 768] as const;

describe('groups list layout regression (#633 responsive)', () => {
    describe.each(TARGET_WIDTHS)('at %ipx width', width => {
        it('resolves balance column without zero width', () => {
            const column = groupCardBalanceColumnStyle(width);
            expect(column.width).toBeGreaterThan(0);
            expect(column.alignItems).toBe('center');
        });

        it('uses stacked header on narrow widths so the title is not truncated', () => {
            if (width <= 392) {
                expect(resolveGroupsListUsesStackedHeader(width)).toBe(true);
            }
        });

        it('shows full create label whenever the header is stacked', () => {
            if (resolveGroupsListUsesStackedHeader(width)) {
                expect(resolveGroupsListCreateShowsLabel(width)).toBe(true);
            }
        });
    });

    it('documents stack vs inline breakpoints for QA widths', () => {
        expect(resolveGroupCardUsesStackedBalance(320)).toBe(true);
        expect(resolveGroupsListUsesStackedHeader(320)).toBe(true);
        expect(resolveGroupsListUsesStackedHeader(375)).toBe(true);
        expect(resolveGroupsListUsesStackedHeader(430)).toBe(false);
    });
});
