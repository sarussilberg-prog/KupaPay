import { Platform } from 'react-native';
import {
    flattenNativeRowStyles,
    groupCardOuterRowStyle,
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

    it('group card outer row uses full width and safe rtl row on iOS', () => {
        const os = Platform.OS;
        ios();
        const style = groupCardOuterRowStyle(true);
        expect(style.width).toBe('100%');
        expect(style.alignSelf).toBe('stretch');
        expect(style.direction).toBe('ltr');
        expect(style.flexDirection).toBe('row-reverse');
        expect(isNativeRowFlexSafe(style)).toBe(true);
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
