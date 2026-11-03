import { I18nManager, Platform } from 'react-native';
import {
    centeredTextStyle,
    feedActorNameStyle,
    resolveAutoTextInputStyle,
    resolveAutoTextStyle,
    resolveCompactTextInputStyle,
    rtlRowStyle,
    rtlTextAlign,
    rtlTextClassName,
} from '../../hooks/useRtlLayout';

describe('useRtlLayout helpers', () => {
    it('uses row-reverse + direction ltr on native when app RTL but I18nManager is still LTR', () => {
        const os = Platform.OS;
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
        const i18nMgr = I18nManager as unknown as { isRTL: boolean };
        const prev = i18nMgr.isRTL;
        i18nMgr.isRTL = false;
        expect(rtlRowStyle(true)).toEqual({
            flexDirection: 'row-reverse',
            direction: 'ltr',
        });
        expect(rtlRowStyle(false)).toEqual({
            flexDirection: 'row',
            direction: 'ltr',
        });
        i18nMgr.isRTL = prev;
        Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
    });

    it('uses physical row (no reverse) when app RTL matches I18nManager.isRTL', () => {
        const os = Platform.OS;
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
        const i18nMgr = I18nManager as unknown as { isRTL: boolean };
        const prev = i18nMgr.isRTL;
        i18nMgr.isRTL = true;
        expect(rtlRowStyle(true)).toEqual({
            flexDirection: 'row',
            direction: 'ltr',
        });
        expect(rtlRowStyle(false)).toEqual({
            flexDirection: 'row-reverse',
            direction: 'ltr',
        });
        i18nMgr.isRTL = prev;
        Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
    });

    it('returns right alignment for Hebrew', () => {
        expect(rtlTextAlign(true)).toBe('right');
        expect(rtlTextAlign(false)).toBe('left');
    });

    it('pins feed actor names to the app edge', () => {
        expect(feedActorNameStyle(true)).toEqual({
            textAlign: 'right',
            alignSelf: 'stretch',
        });
        expect(feedActorNameStyle(false)).toEqual({
            textAlign: 'left',
            alignSelf: 'stretch',
        });
    });

    it('exposes centeredTextStyle for hero and marketing copy', () => {
        expect(centeredTextStyle).toEqual({
            width: '100%',
            textAlign: 'center',
            alignSelf: 'stretch',
        });
    });

    it('adds nativewind alignment classes for Hebrew', () => {
        expect(rtlTextClassName(true, 'text-sm')).toContain('text-right');
        expect(rtlTextClassName(true, 'text-sm')).toContain('self-stretch');
        expect(rtlTextClassName(false, 'text-sm')).toContain('text-left');
    });

    it('aligns a TextInput by direction WITHOUT writingDirection (iOS duplicates the placeholder when it is set)', () => {
        expect(resolveAutoTextInputStyle(true)).toEqual({ textAlign: 'right' });
        expect(resolveAutoTextInputStyle(false)).toEqual({ textAlign: 'left' });
    });

    it('defers to an explicit textAlign passed in the TextInput style', () => {
        expect(resolveAutoTextInputStyle(true, { textAlign: 'center' })).toBeUndefined();
    });

    it('keeps compact search inputs vertically centered on Android', () => {
        const os = Platform.OS;
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
        expect(resolveCompactTextInputStyle(true)).toEqual({
            textAlign: 'right',
            includeFontPadding: false,
            textAlignVertical: 'center',
            paddingVertical: 0,
        });
        Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
    });

    it('applies RTL text styles unless textAlign is explicit', () => {
        expect(resolveAutoTextStyle(true, 'text-sm')).toEqual({
            writingDirection: 'rtl',
        });
        expect(resolveAutoTextStyle(false, 'text-sm')).toEqual({
            writingDirection: 'ltr',
        });
        expect(resolveAutoTextStyle(true, 'text-center')).toEqual({
            writingDirection: 'rtl',
        });
        expect(resolveAutoTextStyle(true, undefined, { textAlign: 'left' })).toBeUndefined();
    });
});
