import { toastTextStyles } from '../../lib/toastConfig';

// Guards the toast RTL fix: on native, textAlign alone does not move the text —
// the <Text> must be stretched to full width or Hebrew stays stuck to the left.
describe('toastTextStyles', () => {
    it('right-aligns and stretches for Hebrew (RTL)', () => {
        const { text1, text2 } = toastTextStyles(true);

        for (const line of [text1, text2]) {
            expect(line.textAlign).toBe('right');
            expect(line.writingDirection).toBe('rtl');
            expect(line.alignSelf).toBe('stretch');
            expect(line.width).toBe('100%');
        }
    });

    it('left-aligns and stretches for English (LTR)', () => {
        const { text1, text2 } = toastTextStyles(false);

        for (const line of [text1, text2]) {
            expect(line.textAlign).toBe('left');
            expect(line.writingDirection).toBe('ltr');
            expect(line.alignSelf).toBe('stretch');
            expect(line.width).toBe('100%');
        }
    });
});
