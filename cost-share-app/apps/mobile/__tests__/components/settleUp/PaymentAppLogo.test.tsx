import React from 'react';
import { render } from '@testing-library/react-native';
import i18n from 'i18next';
import { MOBILE_I18N_LOCALE_CODES } from '../../../i18n/localeConfig';
import { mobileI18nResourcesAllLocales } from '../../../i18n/testLocaleResources';
import {
    PaymentAppLogo,
    PAYMENT_APP_TILE_SIZE,
} from '../../../components/settleUp/PaymentAppLogo';

const APPS = ['bit', 'paybox'] as const;

function labelFor(app: (typeof APPS)[number], locale: string): string {
    void i18n.changeLanguage(locale);
    return i18n.t('settleUp.openPaymentApp', {
        app: i18n.t(`settleUp.paymentAppLabels.${app}`),
    });
}

describe('PaymentAppLogo (#700)', () => {
    beforeAll(async () => {
        await i18n.init({
            resources: mobileI18nResourcesAllLocales,
            lng: 'en',
            fallbackLng: 'en',
            interpolation: { escapeValue: false },
        });
    });

    it.each(APPS)('%s uses the shared tile size and shape', (app) => {
        const { getByTestId } = render(
            <PaymentAppLogo app={app} accessibilityLabel={labelFor(app, 'en')} />,
        );
        const tile = getByTestId(`payment-app-logo-${app}`);
        expect(tile.props.style).toEqual(
            expect.objectContaining({
                width: PAYMENT_APP_TILE_SIZE,
                height: PAYMENT_APP_TILE_SIZE,
                borderRadius: 14,
            }),
        );
    });

    it('bit and paybox tiles share identical dimensions', () => {
        const bit = render(
            <PaymentAppLogo app="bit" accessibilityLabel={labelFor('bit', 'en')} />,
        ).getByTestId('payment-app-logo-bit');
        const paybox = render(
            <PaymentAppLogo app="paybox" accessibilityLabel={labelFor('paybox', 'en')} />,
        ).getByTestId('payment-app-logo-paybox');

        expect(bit.props.style).toEqual(
            expect.objectContaining({
                width: paybox.props.style.width,
                height: paybox.props.style.height,
                borderRadius: paybox.props.style.borderRadius,
            }),
        );
    });

    it.each(MOBILE_I18N_LOCALE_CODES)('%s exposes localized accessibility labels for both apps', (locale) => {
        for (const app of APPS) {
            const expected = labelFor(app, locale);
            expect(expected).not.toMatch(/^settleUp\./);
            const { getByLabelText } = render(
                <PaymentAppLogo app={app} accessibilityLabel={expected} />,
            );
            expect(getByLabelText(expected)).toBeTruthy();
        }
    });
});
