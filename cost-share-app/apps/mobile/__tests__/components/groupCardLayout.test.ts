import {
    GROUP_CARD_CHIP_MAX_WIDTH,
    groupCardBalanceColumnStyle,
} from '../../components/groupCardLayout';

describe('groupCardBalanceColumnStyle', () => {
    it('uses a fixed-width trailing column for balance pills', () => {
        expect(groupCardBalanceColumnStyle.width).toBe(GROUP_CARD_CHIP_MAX_WIDTH);
        expect(groupCardBalanceColumnStyle.alignItems).toBe('center');
    });
});
