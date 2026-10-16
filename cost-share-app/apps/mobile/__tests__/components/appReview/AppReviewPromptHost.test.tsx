import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { AppReviewPromptHost } from '../../../components/appReview/AppReviewPromptHost';
import { useAppStore } from '../../../store';
import * as StoreReview from 'expo-store-review';
import { captureProductEvent } from '../../../lib/productAnalytics';

jest.mock('expo-store-review', () => ({
    isAvailableAsync: jest.fn(async () => true),
    requestReview: jest.fn(async () => {}),
}));

jest.mock('../../../lib/productAnalytics', () => ({
    captureProductEvent: jest.fn(async () => {}),
}));

jest.mock('../../../lib/rootNavigationRef', () => ({
    rootNavigationRef: { isReady: () => true, navigate: jest.fn() },
}));

describe('AppReviewPromptHost', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useAppStore.setState({ pendingAppReview: null, pendingNavigation: null });
    });

    it('shows sheet when pendingAppReview is set', () => {
        useAppStore.setState({ pendingAppReview: { trigger: 'first_settle_up' } });
        const { getByTestId } = render(<AppReviewPromptHost />);
        expect(getByTestId('app-review-pre-prompt-sheet')).toBeTruthy();
        expect(captureProductEvent).toHaveBeenCalledWith('review_pre_prompt_shown', {
            trigger: 'first_settle_up',
        });
    });

    it('requests native review on happy path', async () => {
        useAppStore.setState({ pendingAppReview: { trigger: 'third_expense' } });
        const { getByTestId } = render(<AppReviewPromptHost />);
        fireEvent.press(getByTestId('app-review-happy-cta'));
        await waitFor(() => {
            expect(StoreReview.requestReview).toHaveBeenCalled();
            expect(captureProductEvent).toHaveBeenCalledWith('review_pre_prompt_happy', {
                trigger: 'third_expense',
            });
            expect(captureProductEvent).toHaveBeenCalledWith('review_prompt_shown', {
                trigger: 'third_expense',
            });
        });
        expect(useAppStore.getState().pendingAppReview).toBeNull();
    });

    it('routes unhappy users via pendingNavigation on native', async () => {
        const originalOs = Platform.OS;
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
        useAppStore.setState({ pendingAppReview: { trigger: 'first_settle_up' } });
        const { getByTestId } = render(<AppReviewPromptHost />);
        fireEvent.press(getByTestId('app-review-unhappy-cta'));
        await waitFor(() => {
            expect(captureProductEvent).toHaveBeenCalledWith('review_pre_prompt_unhappy', {
                trigger: 'first_settle_up',
            });
        });
        Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOs });
    });
});
