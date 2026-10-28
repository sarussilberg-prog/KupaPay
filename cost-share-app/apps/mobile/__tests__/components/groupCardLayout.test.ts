import {
    GROUP_CARD_CHIP_MAX_WIDTH,
    GROUP_CARD_CHIP_MIN_WIDTH,
    groupCardBalanceColumnStyle,
    resolveGroupCardBalanceColumnWidth,
    resolveGroupCardUsesStackedBalance,
} from '../../components/groupCardLayout';

const WIDTHS = [320, 360, 375, 390, 430, 768] as const;

describe('groupCardLayout responsive metrics', () => {
    it.each(WIDTHS)('balance column width stays within min/max at %ipx', width => {
        const columnWidth = resolveGroupCardBalanceColumnWidth(width);
        expect(columnWidth).toBeGreaterThanOrEqual(GROUP_CARD_CHIP_MIN_WIDTH);
        expect(columnWidth).toBeLessThanOrEqual(GROUP_CARD_CHIP_MAX_WIDTH);
    });

    it('stacks balance chip on narrow phones', () => {
        expect(resolveGroupCardUsesStackedBalance(320)).toBe(true);
        expect(resolveGroupCardUsesStackedBalance(360)).toBe(true);
    });

    it('keeps inline balance on mid and large widths', () => {
        expect(resolveGroupCardUsesStackedBalance(375)).toBe(false);
        expect(resolveGroupCardUsesStackedBalance(390)).toBe(false);
        expect(resolveGroupCardUsesStackedBalance(430)).toBe(false);
        expect(resolveGroupCardUsesStackedBalance(768)).toBe(false);
    });

    it('uses full max chip width on tablet inline layout', () => {
        expect(resolveGroupCardBalanceColumnWidth(768)).toBe(GROUP_CARD_CHIP_MAX_WIDTH);
    });

    it('centers pills in a width-scaled column', () => {
        const style = groupCardBalanceColumnStyle(390);
        expect(style.alignItems).toBe('center');
        expect(style.width).toBeGreaterThan(GROUP_CARD_CHIP_MIN_WIDTH);
        expect(style.width).toBeLessThanOrEqual(GROUP_CARD_CHIP_MAX_WIDTH);
    });
});
