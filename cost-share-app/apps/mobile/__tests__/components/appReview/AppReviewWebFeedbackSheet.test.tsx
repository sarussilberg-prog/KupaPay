import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AppReviewWebFeedbackSheet } from '../../../components/appReview/AppReviewWebFeedbackSheet';
import { RtlLayoutProvider } from '../../../hooks/useRtlLayout';

jest.mock('../../../store', () => ({
    useAppStore: (selector: (state: { language: 'he' | 'en' }) => unknown) =>
        selector({ language: 'he' }),
}));

describe('AppReviewWebFeedbackSheet', () => {
    it('renders web feedback copy and actions', () => {
        const { getByTestId, getByText } = render(
            <AppReviewWebFeedbackSheet visible onClose={() => {}} onShareFeedback={() => {}} />,
        );
        expect(getByText('appReview.webTitle')).toBeTruthy();
        expect(getByTestId('app-review-web-feedback-cta')).toBeTruthy();
    });

    it('fires callbacks', () => {
        const onClose = jest.fn();
        const onShareFeedback = jest.fn();
        const { getByTestId, getByText } = render(
            <AppReviewWebFeedbackSheet visible onClose={onClose} onShareFeedback={onShareFeedback} />,
        );
        fireEvent.press(getByTestId('app-review-web-feedback-cta'));
        fireEvent.press(getByText('appReview.notNow'));
        expect(onShareFeedback).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
    });

    it('aligns copy for RTL (Hebrew)', () => {
        const { getByText } = render(
            <RtlLayoutProvider>
                <AppReviewWebFeedbackSheet visible onClose={() => {}} onShareFeedback={() => {}} />
            </RtlLayoutProvider>,
        );
        const title = getByText('appReview.webTitle');
        expect(title.props.className).toContain('text-start');
    });
});
