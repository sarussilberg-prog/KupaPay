import React from 'react';
import { Platform } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { PromoCodeRedeemSheet } from '../../components/pro/PromoCodeRedeemSheet';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

jest.mock('../../hooks/useRtlLayout', () => ({
    useRtlLayout: () => false,
}));

jest.mock('../../components/AppText', () => {
    const { Text } = require('react-native');
    return { Text: (props: Record<string, unknown>) => <Text {...props} /> };
});

jest.mock('../../components/Button', () => {
    const { Pressable, Text } = require('react-native');
    return {
        Button: ({ title, onPress, testID }: { title: string; onPress?: () => void; testID?: string }) => (
            <Pressable onPress={onPress} testID={testID}>
                <Text>{title}</Text>
            </Pressable>
        ),
    };
});

jest.mock('../../services/promoCode.service', () => ({
    redeemKupaPayPromoCode: jest.fn(),
}));

jest.mock('../../services/purchases.service', () => ({
    presentOfferCodeRedemption: jest.fn(),
}));

import { redeemKupaPayPromoCode } from '../../services/promoCode.service';

const redeemMock = redeemKupaPayPromoCode as jest.MockedFunction<typeof redeemKupaPayPromoCode>;

describe('PromoCodeRedeemSheet', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        redeemMock.mockResolvedValue({ ok: true, proUntil: '2026-11-01', durationDays: 14 });
    });

    it('renders KupaPay input on web without store section', () => {
        const prev = Platform.OS;
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
        const { getByTestId, queryByTestId } = render(
            <PromoCodeRedeemSheet visible onClose={jest.fn()} />,
        );
        expect(getByTestId('promo-code-input')).toBeTruthy();
        expect(queryByTestId('promo-store-ios-redeem')).toBeNull();
        expect(queryByTestId('promo-store-play-redeem')).toBeNull();
        Object.defineProperty(Platform, 'OS', { configurable: true, value: prev });
    });

    it('calls redeem on save', async () => {
        const onClose = jest.fn();
        const { getByTestId, getByText } = render(
            <PromoCodeRedeemSheet visible onClose={onClose} />,
        );
        fireEvent.changeText(getByTestId('promo-code-input'), 'TEST-CODE');
        fireEvent.press(getByText('common.save'));
        await Promise.resolve();
        expect(redeemMock).toHaveBeenCalledWith('TEST-CODE');
    });
});
