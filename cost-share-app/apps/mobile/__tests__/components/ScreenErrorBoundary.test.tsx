import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import * as Sentry from '@sentry/react-native';
import { ScreenErrorBoundary } from '../../components/ScreenErrorBoundary';

let shouldThrow = true;

function FlakyChild() {
    if (shouldThrow) {
        throw new Error('render boom');
    }
    return <Text testID="child-ok">ok</Text>;
}

describe('ScreenErrorBoundary', () => {
    beforeEach(() => {
        shouldThrow = true;
        jest.clearAllMocks();
    });

    const platforms = ['ios', 'android', 'web'] as const;

    it.each(platforms)('captures to Sentry and shows fallback on %s', (platform) => {
        jest.replaceProperty(
            require('react-native').Platform,
            'OS',
            platform,
        );

        const { getByTestId } = render(
            <ScreenErrorBoundary screenName="UnitTestScreen">
                <FlakyChild />
            </ScreenErrorBoundary>,
        );

        expect(getByTestId('screen-error-fallback')).toBeTruthy();
        expect(Sentry.captureException).toHaveBeenCalled();
    });

    it('recovers after retry when the child stops throwing', () => {
        const { getByTestId, getByText } = render(
            <ScreenErrorBoundary screenName="UnitTestScreen">
                <FlakyChild />
            </ScreenErrorBoundary>,
        );

        shouldThrow = false;
        fireEvent.press(getByText('common.retry'));
        expect(getByTestId('child-ok')).toBeTruthy();
    });
});
