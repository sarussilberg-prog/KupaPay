import { resolveSubscriptionPriceFromOffering } from '../subscriptionDisplayPrice';

const monthlyPkg = {
    identifier: '$rc_monthly',
    product: { identifier: 'kupapay_pro_monthly', priceString: '₪12.90' },
};

const annualPkg = {
    identifier: '$rc_annual',
    product: { identifier: 'kupapay_pro_yearly', priceString: '₪69.90' },
};

describe('resolveSubscriptionPriceFromOffering', () => {
    it('uses the matching offering package localized priceString', () => {
        expect(
            resolveSubscriptionPriceFromOffering(
                'kupapay_pro_monthly',
                [monthlyPkg, annualPkg],
                { monthly: monthlyPkg, annual: annualPkg, tripPass: null },
            ),
        ).toBe('₪12.90');
    });

    it('does not use a mismatched slot price when the product id matches another package', () => {
        const wrongMonthly = {
            identifier: '$rc_monthly',
            product: { identifier: 'kupapay_pro_monthly', priceString: '$3.99' },
        };
        expect(
            resolveSubscriptionPriceFromOffering(
                'kupapay_pro_monthly',
                [wrongMonthly, annualPkg],
                { monthly: wrongMonthly, annual: annualPkg, tripPass: null },
            ),
        ).toBe('$3.99');
    });

    it('resolves Play-style base plan product ids', () => {
        expect(
            resolveSubscriptionPriceFromOffering(
                'kupapay_pro_monthly:monthly',
                [monthlyPkg],
                { monthly: monthlyPkg, annual: null, tripPass: null },
            ),
        ).toBe('₪12.90');
    });
});
