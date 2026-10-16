import {
    DEFAULT_INTRO_FREE_TRIAL_DAYS,
    INTRO_ELIGIBILITY_ELIGIBLE,
    introFreeTrialDaysForPackage,
    introFreeTrialDaysFromIntroPrice,
    isProductIntroEligible,
    packageHasIntroFreeTrial,
    planShowsFreeTrial,
} from '../proTrialPaywall';
import type { PaywallPackages } from '../purchasesPackage.types';

const pkgWithTrial = {
    identifier: '$rc_monthly',
    product: {
        identifier: 'kupapay_pro_monthly',
        priceString: '₪12.90',
        introPrice: { price: 0, priceString: '₪0.00', periodNumberOfUnits: 2, periodUnit: 'WEEK' },
    },
};

const pkgNoTrial = {
    identifier: '$rc_annual',
    product: {
        identifier: 'kupapay_pro_yearly',
        priceString: '₪69.90',
    },
};

describe('introFreeTrialDaysFromIntroPrice', () => {
    it('converts store intro periods to days', () => {
        expect(
            introFreeTrialDaysFromIntroPrice({
                price: 0,
                priceString: '₪0.00',
                periodNumberOfUnits: 2,
                periodUnit: 'WEEK',
            }),
        ).toBe(14);
        expect(introFreeTrialDaysFromIntroPrice(null)).toBeNull();
    });
});

describe('introFreeTrialDaysForPackage', () => {
    it('uses 14-day policy for intro offers even when store reports 7 days', () => {
        const oneWeekIntro = {
            identifier: '$rc_monthly',
            product: {
                identifier: 'kupapay_pro_monthly',
                priceString: '₪12.90',
                introPrice: {
                    price: 0,
                    priceString: '₪0.00',
                    periodNumberOfUnits: 1,
                    periodUnit: 'WEEK',
                },
            },
        };
        expect(introFreeTrialDaysForPackage(oneWeekIntro)).toBe(14);
        expect(introFreeTrialDaysForPackage(pkgWithTrial)).toBe(14);
        expect(introFreeTrialDaysForPackage(pkgNoTrial)).toBe(DEFAULT_INTRO_FREE_TRIAL_DAYS);
    });
});

describe('packageHasIntroFreeTrial', () => {
    it('detects zero-price intro', () => {
        expect(packageHasIntroFreeTrial(pkgWithTrial)).toBe(true);
        expect(packageHasIntroFreeTrial(pkgNoTrial)).toBe(false);
    });
});

describe('planShowsFreeTrial', () => {
    const packages: PaywallPackages = {
        monthly: pkgWithTrial,
        annual: pkgNoTrial,
        tripPass: null,
    };

    it('requires eligibility and intro offer', () => {
        expect(
            planShowsFreeTrial('monthly', packages, {
                kupapay_pro_monthly: { status: INTRO_ELIGIBILITY_ELIGIBLE },
            }),
        ).toBe(true);
        expect(planShowsFreeTrial('monthly', packages, {})).toBe(false);
        expect(
            planShowsFreeTrial('yearly', packages, {
                kupapay_pro_yearly: { status: INTRO_ELIGIBILITY_ELIGIBLE },
            }),
        ).toBe(false);
    });
});

describe('isProductIntroEligible', () => {
    it('matches RevenueCat eligible status code', () => {
        expect(
            isProductIntroEligible(
                { kupapay_pro_monthly: { status: INTRO_ELIGIBILITY_ELIGIBLE } },
                'kupapay_pro_monthly',
            ),
        ).toBe(true);
        expect(
            isProductIntroEligible({ kupapay_pro_monthly: { status: 1 } }, 'kupapay_pro_monthly'),
        ).toBe(false);
    });
});
