import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AppReviewPrePromptSheet } from '../../../components/appReview/AppReviewPrePromptSheet';
import { RtlLayoutProvider } from '../../../hooks/useRtlLayout';

jest.mock('../../../store', () => ({
    useAppStore: (selector: (state: { language: 'he' | 'en' }) => unknown) =>
        selector({ language: 'he' }),
}));

describe('AppReviewPrePromptSheet', () => {
    it('renders native pre-prompt actions', () => {
        const { getByTestId, getByText } = render(
            <AppReviewPrePromptSheet
                visible
                mode="native"
                onClose={() => {}}
                onHappy={() => {}}
                onUnhappy={() => {}}
            />,
        );
        expect(getByText('appReview.prePromptTitle')).toBeTruthy();
        expect(getByTestId('app-review-happy-cta')).toBeTruthy();
        expect(getByTestId('app-review-unhappy-cta')).toBeTruthy();
    });

    it('renders web feedback variant without unhappy CTA', () => {
        const { getByTestId, queryByTestId, getByText } = render(
            <AppReviewPrePromptSheet
                visible
                mode="web"
                onClose={() => {}}
                onHappy={() => {}}
                onUnhappy={() => {}}
            />,
        );
        expect(getByText('appReview.webTitle')).toBeTruthy();
        expect(getByTestId('app-review-happy-cta')).toBeTruthy();
        expect(queryByTestId('app-review-unhappy-cta')).toBeNull();
    });

    it('fires callbacks', () => {
        const onClose = jest.fn();
        const onHappy = jest.fn();
        const onUnhappy = jest.fn();
        const { getByTestId, getByText } = render(
            <AppReviewPrePromptSheet
                visible
                mode="native"
                onClose={onClose}
                onHappy={onHappy}
                onUnhappy={onUnhappy}
            />,
        );
        fireEvent.press(getByTestId('app-review-happy-cta'));
        fireEvent.press(getByTestId('app-review-unhappy-cta'));
        fireEvent.press(getByText('appReview.notNow'));
        expect(onHappy).toHaveBeenCalled();
        expect(onUnhappy).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
    });

    it('aligns copy for RTL (Hebrew)', () => {
        const { getByText } = render(
            <RtlLayoutProvider>
                <AppReviewPrePromptSheet
                    visible
                    mode="native"
                    onClose={() => {}}
                    onHappy={() => {}}
                    onUnhappy={() => {}}
                />
            </RtlLayoutProvider>,
        );
        const title = getByText('appReview.prePromptTitle');
        expect(title.props.className).toContain('text-start');
    });
});
