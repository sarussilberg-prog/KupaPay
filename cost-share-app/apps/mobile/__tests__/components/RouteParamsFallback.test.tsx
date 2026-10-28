import React from 'react';
import { Platform } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        goBack: mockGoBack,
        canGoBack: mockCanGoBack,
    }),
}));

import { RouteParamsFallback } from '../../components/RouteParamsFallback';

describe('RouteParamsFallback', () => {
    const originalOs = Platform.OS;

    afterEach(() => {
        Platform.OS = originalOs;
        mockGoBack.mockClear();
        mockCanGoBack.mockClear();
    });

    it.each(['ios', 'android', 'web'] as const)(
        'shows load error copy on %s when params are missing',
        (os) => {
            Platform.OS = os;
            mockCanGoBack.mockReturnValue(false);
            const { getByTestId, getByText } = render(<RouteParamsFallback />);
            expect(getByTestId('route-params-fallback')).toBeTruthy();
            expect(getByText('common.error')).toBeTruthy();
            expect(getByText('common.loadError')).toBeTruthy();
        },
    );

    it('offers back navigation when the stack can go back', () => {
        mockCanGoBack.mockReturnValue(true);
        const { getByText } = render(<RouteParamsFallback />);
        fireEvent.press(getByText('common.back'));
        expect(mockGoBack).toHaveBeenCalledTimes(1);
    });
});
