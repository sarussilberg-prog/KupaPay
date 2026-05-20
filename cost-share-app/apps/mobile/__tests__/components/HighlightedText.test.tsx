import React from 'react';
import { render } from '@testing-library/react-native';
import { HighlightedText } from '../../components/HighlightedText';
import { RtlLayoutProvider } from '../../hooks/useRtlLayout';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        i18n: { language: 'he' },
        t: (key: string) => key,
    }),
}));

jest.mock('../../store', () => ({
    useAppStore: (selector: (state: { language: 'he' | 'en' }) => unknown) =>
        selector({ language: 'he' }),
}));

describe('HighlightedText', () => {
    it('renders plain text when no query is provided', () => {
        const { getByText } = render(<HighlightedText text="Hello world" />);
        expect(getByText('Hello world')).toBeTruthy();
    });

    it('renders plain text when query is empty after trim', () => {
        const { getByText } = render(<HighlightedText text="Hello" query="   " />);
        expect(getByText('Hello')).toBeTruthy();
    });

    it('case-insensitively splits text around matches', () => {
        const { queryByText } = render(
            <HighlightedText text="aBcAbC" query="ab" />,
        );
        // matches are split out into nested Text elements; we can find them individually
        expect(queryByText('aB')).toBeTruthy();
        expect(queryByText('Ab')).toBeTruthy();
    });

    it('aligns English text to the right when app language is Hebrew', () => {
        const { getByText } = render(
            <RtlLayoutProvider>
                <HighlightedText text="Trip to Paris" testID="group-name" />
            </RtlLayoutProvider>,
        );
        expect(getByText('Trip to Paris').props.className).toContain('text-right');
        expect(getByText('Trip to Paris').props.style).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ writingDirection: 'rtl' }),
            ]),
        );
    });
});
