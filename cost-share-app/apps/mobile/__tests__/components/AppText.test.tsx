import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from '../../components/AppText';
import { RtlLayoutProvider } from '../../hooks/useRtlLayout';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: 'he' },
    }),
}));

jest.mock('../../store', () => ({
    useAppStore: (selector: (state: { language: 'he' | 'en' }) => unknown) =>
        selector({ language: 'he' }),
}));

describe('AppText', () => {
    it('aligns Hebrew text to the right by default', () => {
        const { getByText } = render(
            <RtlLayoutProvider>
                <Text>שלום</Text>
            </RtlLayoutProvider>,
        );

        expect(getByText('שלום').props.className).toContain('text-right');
        expect(getByText('שלום').props.style).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ writingDirection: 'rtl' }),
            ]),
        );
    });

    it('keeps centered text centered in Hebrew', () => {
        const { getByText } = render(
            <RtlLayoutProvider>
                <Text className="text-center">מרכז</Text>
            </RtlLayoutProvider>,
        );

        expect(getByText('מרכז').props.className).not.toContain('text-right');
        expect(getByText('מרכז').props.style).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ writingDirection: 'rtl' }),
            ]),
        );
    });
});
