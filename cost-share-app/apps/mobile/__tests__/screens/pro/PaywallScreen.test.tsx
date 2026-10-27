import React from 'react';
import { render } from '@testing-library/react-native';
import { PaywallScreen } from '../../../screens/pro/PaywallScreen';

const paywallProps: Array<Record<string, unknown>> = [];

jest.mock('../../../components/pro/ProPaywallContent', () => ({
    ProPaywallContent: (props: Record<string, unknown>) => {
        paywallProps.push(props);
        return null;
    },
}));

const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ goBack: mockGoBack }),
    useRoute: jest.fn(),
}));

import { useRoute } from '@react-navigation/native';

const useRouteMock = useRoute as jest.Mock;

describe('PaywallScreen Trip Pass visibility', () => {
    beforeEach(() => {
        paywallProps.length = 0;
        mockGoBack.mockClear();
        useRouteMock.mockReturnValue({ params: { featureKey: 'settings' } });
    });

    it('shows Trip Pass by default when route omits showTripPass', () => {
        render(<PaywallScreen />);
        expect(paywallProps[paywallProps.length - 1]?.showTripPass).toBe(true);
    });

    it('hides Trip Pass only when route sets showTripPass false', () => {
        useRouteMock.mockReturnValue({
            params: { featureKey: 'settings', showTripPass: false },
        });
        render(<PaywallScreen />);
        expect(paywallProps[paywallProps.length - 1]?.showTripPass).toBe(false);
    });

    it('shows Trip Pass when route sets showTripPass true', () => {
        useRouteMock.mockReturnValue({
            params: { featureKey: 'recurring_expenses', groupId: 'g1', showTripPass: true },
        });
        render(<PaywallScreen />);
        expect(paywallProps[paywallProps.length - 1]?.showTripPass).toBe(true);
    });
});
