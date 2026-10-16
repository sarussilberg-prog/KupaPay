/** @jest-environment jsdom */

import React from 'react';
import { Platform } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { WebAlertHost } from '../../components/WebAlertHost';
import { platformAlert } from '../../lib/platformAlert';

const originalPlatform = Platform.OS;

jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

describe('WebAlertHost', () => {
    beforeEach(() => {
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    });

    afterEach(() => {
        Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    });

    it('invokes Cancel button onPress when backdrop is pressed', async () => {
        const onCancel = jest.fn();
        const { getByTestId } = render(<WebAlertHost />);

        platformAlert('Title', 'Message', [
            { text: 'Cancel', style: 'cancel', onPress: onCancel },
            { text: 'Option B', onPress: jest.fn() },
            { text: 'Option C', onPress: jest.fn() },
        ]);

        await waitFor(() => {
            expect(getByTestId('web-alert-backdrop')).toBeTruthy();
        });

        fireEvent.press(getByTestId('web-alert-backdrop'));
        expect(onCancel).toHaveBeenCalledTimes(1);
    });
});
