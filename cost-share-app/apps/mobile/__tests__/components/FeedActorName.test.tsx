import React from 'react';
import { I18nManager, Platform } from 'react-native';
import { render } from '@testing-library/react-native';
import { FeedActorName } from '../../components/FeedActorName';
import { rtlTextAlign, rtlWritingDirection } from '../../hooks/useRtlLayout';
import { useAppStore } from '../../store';

function flattenStyle(style: unknown): Record<string, unknown> {
    if (Array.isArray(style)) {
        return Object.assign({}, ...style.filter(Boolean));
    }
    return (style as Record<string, unknown>) ?? {};
}

describe('FeedActorName', () => {
    const setPlatform = (os: typeof Platform.OS) => {
        Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
    };

    const setNativeIsRtl = (value: boolean) => {
        (I18nManager as unknown as { isRTL: boolean }).isRTL = value;
    };

    afterEach(() => {
        setPlatform('ios');
        setNativeIsRtl(false);
        useAppStore.setState({ language: 'en' });
    });

    it('aligns English names to the app start edge in Hebrew UI (native RTL synced)', () => {
        setPlatform('ios');
        setNativeIsRtl(true);
        useAppStore.setState({ language: 'he' });
        const { getByText } = render(<FeedActorName name="Bob" />);
        const flat = flattenStyle(getByText('Bob').props.style);
        expect(flat.textAlign).toBe(rtlTextAlign(true));
        expect(flat.writingDirection).toBe(rtlWritingDirection(true));
        expect(flat.textAlign).toBe('left');
    });

    it('aligns Hebrew names to the app start edge in English UI', () => {
        setPlatform('ios');
        setNativeIsRtl(false);
        useAppStore.setState({ language: 'en' });
        const { getByText } = render(<FeedActorName name="דני" />);
        const flat = flattenStyle(getByText('דני').props.style);
        expect(flat.textAlign).toBe(rtlTextAlign(false));
        expect(flat.writingDirection).toBe(rtlWritingDirection(false));
        expect(flat.textAlign).toBe('left');
    });

    it('uses web physical textAlign for Hebrew UI start edge', () => {
        setPlatform('web');
        useAppStore.setState({ language: 'he' });
        const { getByText } = render(<FeedActorName name="Bob" />);
        const flat = flattenStyle(getByText('Bob').props.style);
        expect(flat.textAlign).toBe('right');
        expect(flat.writingDirection).toBe('rtl');
    });
});
