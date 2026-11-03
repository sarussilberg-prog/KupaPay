import { Platform } from 'react-native';
import {
    flattenNativeRowStyles,
    groupCardInnerRowStyle,
    groupCardShellStyle,
    isNativeRowFlexSafe,
    listRowFlexStyle,
} from '../../lib/nativeRowLayoutStyle';
import { rtlRowStyle } from '../../hooks/useRtlLayout';

describe('nativeRowLayoutStyle', () => {
    const ios = () => {
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    };
    const web = () => {
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    };
    const restore = (os: typeof Platform.OS) => {
        Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
    };

    it('flags native direction:rtl combined with flex growth (New Architecture regression)', () => {
        const os = Platform.OS;
        ios();
        expect(isNativeRowFlexSafe({ direction: 'rtl', flex: 1 })).toBe(false);
        expect(isNativeRowFlexSafe({ direction: 'rtl', flexGrow: 1 })).toBe(false);
        expect(isNativeRowFlexSafe({ direction: 'ltr', flex: 1 })).toBe(true);
        expect(isNativeRowFlexSafe(rtlRowStyle(true))).toBe(true);
        restore(os);
    });

    it('allows web direction:rtl with flex (web-only pattern)', () => {
        const os = Platform.OS;
        web();
        expect(isNativeRowFlexSafe({ direction: 'rtl', flex: 1 })).toBe(true);
        restore(os);
    });

    it('group card shell is a stretch column (not a flex row) on iOS', () => {
        const os = Platform.OS;
        ios();
        const shell = groupCardShellStyle(true);
        expect(shell.width).toBe('100%');
        expect(shell.alignSelf).toBe('stretch');
        expect(shell.flexDirection).toBe('column');
        expect(isNativeRowFlexSafe(shell)).toBe(true);
        restore(os);
    });

    it('group card inner row is full-width horizontal flex without self flex growth', () => {
        const os = Platform.OS;
        ios();
        const row = groupCardInnerRowStyle(true);
        expect(row.width).toBe('100%');
        expect(row.flexDirection).toBe('row-reverse');
        expect(row.direction).toBe('ltr');
        expect(row.flexGrow).toBe(0);
        expect(row.flex).toBeUndefined();
        expect(isNativeRowFlexSafe(row)).toBe(true);
        restore(os);
    });

    it('list row flex styles stay native-safe at several logical widths', () => {
        const os = Platform.OS;
        ios();
        for (const isRtl of [false, true]) {
            const style = listRowFlexStyle(isRtl);
            expect(style.flexGrow).toBe(1);
            expect(style.flexBasis).toBe(0);
            expect(isNativeRowFlexSafe(flattenNativeRowStyles(style))).toBe(true);
        }
        restore(os);
    });
});
