import { I18nManager, Platform } from 'react-native';
import {
    isNativeRtlSynced,
    resolveAutoTextInputStyle,
    resolveAutoTextStyle,
    rtlForwardChevronIcon,
    rtlRowStyle,
    rtlTextAlign,
    rtlTextClassName,
} from '../../hooks/useRtlLayout';

describe('useRtlLayout helpers', () => {
    const setPlatform = (os: typeof Platform.OS) => {
        Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
    };

    const setNativeIsRtl = (value: boolean) => {
        const i18nMgr = I18nManager as unknown as { isRTL: boolean };
        i18nMgr.isRTL = value;
    };

    afterEach(() => {
        setPlatform('ios');
        setNativeIsRtl(false);
    });

    it('native synced RTL uses plain row without direction override', () => {
        setPlatform('ios');
        setNativeIsRtl(true);
        expect(isNativeRtlSynced(true)).toBe(true);
        expect(rtlRowStyle(true)).toEqual({ flexDirection: 'row' });
        expect(rtlRowStyle(true).direction).toBeUndefined();
    });

    it('native synced LTR uses plain row', () => {
        setPlatform('ios');
        setNativeIsRtl(false);
        expect(isNativeRtlSynced(false)).toBe(true);
        expect(rtlRowStyle(false)).toEqual({ flexDirection: 'row' });
    });

    it('uses row-reverse only when app RTL differs from I18nManager until reload', () => {
        setPlatform('ios');
        setNativeIsRtl(false);
        expect(isNativeRtlSynced(true)).toBe(false);
        expect(rtlRowStyle(true)).toEqual({ flexDirection: 'row-reverse' });

        setNativeIsRtl(true);
        expect(isNativeRtlSynced(false)).toBe(false);
        expect(rtlRowStyle(false)).toEqual({ flexDirection: 'row-reverse' }); // native still RTL
    });

    it('web row style does not set per-row direction (root dir handles mirroring)', () => {
        setPlatform('web');
        expect(rtlRowStyle(true)).toEqual({ flexDirection: 'row' });
        expect(rtlRowStyle(false)).toEqual({ flexDirection: 'row' });
    });

    it('rtlTextAlign maps app language to physical edges', () => {
        expect(rtlTextAlign(true)).toBe('right');
        expect(rtlTextAlign(false)).toBe('left');
    });

    it('rtlTextClassName adds edge alignment when not explicit', () => {
        expect(rtlTextClassName(true, 'text-sm')).toContain('text-right');
        expect(rtlTextClassName(true, 'text-sm')).toContain('self-stretch');
        expect(rtlTextClassName(false, 'text-sm')).toContain('text-left');
    });

    it('resolveAutoTextInputStyle sets textAlign only', () => {
        expect(resolveAutoTextInputStyle(true)).toEqual({ textAlign: 'right' });
        expect(resolveAutoTextInputStyle(false)).toEqual({ textAlign: 'left' });
    });

    it('resolveAutoTextStyle sets writingDirection when textAlign not set', () => {
        expect(resolveAutoTextStyle(true)).toEqual({
            writingDirection: 'rtl',
        });
        expect(resolveAutoTextStyle(false)).toEqual({
            writingDirection: 'ltr',
        });
        expect(resolveAutoTextStyle(true, undefined, { textAlign: 'left' })).toBeUndefined();
    });

    it('rtlForwardChevronIcon flips for RTL', () => {
        expect(rtlForwardChevronIcon(false)).toBe('chevron-forward');
        expect(rtlForwardChevronIcon(true)).toBe('chevron-back');
    });
});
