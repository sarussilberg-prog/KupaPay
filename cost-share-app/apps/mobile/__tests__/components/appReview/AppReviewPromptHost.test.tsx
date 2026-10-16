import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { AppReviewPromptHost } from '../../../components/appReview/AppReviewPromptHost';
import { useAppStore } from '../../../store';
import { captureProductEvent } from '../../../lib/productAnalytics';

jest.mock('../../../lib/productAnalytics', () => ({
    captureProductEvent: jest.fn(async () => {}),
}));

jest.mock('../../../lib/rootNavigationRef', () => ({
    rootNavigationRef: { isReady: () => true, navigate: jest.fn() },
}));

describe('AppReviewPromptHost', () => {
    const originalOs = Platform.OS;

    beforeEach(() => {
        jest.clearAllMocks();
        useAppStore.setState({ pendingAppReview: null, pendingNavigation: null });
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    });

    afterEach(() => {
        Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOs });
    });

    it('shows web feedback sheet when pendingAppReview is set', () => {
        useAppStore.setState({ pendingAppReview: { trigger: 'first_settle_up' } });
        const { getByTestId } = render(<AppReviewPromptHost />);
        expect(getByTestId('app-review-web-feedback-sheet')).toBeTruthy();
        expect(captureProductEvent).toHaveBeenCalledWith('review_web_feedback_shown', {
            trigger: 'first_settle_up',
        });
    });

    it('tracks CTA and clears pending state', async () => {
        useAppStore.setState({ pendingAppReview: { trigger: 'third_expense' } });
        const { getByTestId } = render(<AppReviewPromptHost />);
        fireEvent.press(getByTestId('app-review-web-feedback-cta'));
        await waitFor(() => {
            expect(captureProductEvent).toHaveBeenCalledWith('review_web_feedback_cta', {
                trigger: 'third_expense',
            });
        });
        expect(useAppStore.getState().pendingAppReview).toBeNull();
    });

    it('renders nothing on native platforms', () => {
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
        useAppStore.setState({ pendingAppReview: { trigger: 'first_settle_up' } });
        const { queryByTestId } = render(<AppReviewPromptHost />);
        expect(queryByTestId('app-review-web-feedback-sheet')).toBeNull();
    });
});
