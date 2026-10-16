import { findOfferingPackage } from '../revenueCatOfferingPackages';
import { STORE_PRODUCT_TRIP_PASS } from '../proConstants';

describe('findOfferingPackage', () => {
    const packages = [
        {
            identifier: '$rc_monthly',
            product: { identifier: 'kupapay_pro_monthly' },
        },
        {
            identifier: 'kupapay_trip_pass',
            product: { identifier: STORE_PRODUCT_TRIP_PASS },
        },
    ];

    it('finds by RevenueCat package identifier', () => {
        expect(findOfferingPackage(packages, '$rc_monthly')).toEqual(packages[0]);
    });

    it('finds Trip Pass by Play/App Store product id when package id differs', () => {
        expect(findOfferingPackage(packages, 'trip_pass', STORE_PRODUCT_TRIP_PASS)).toEqual(
            packages[1],
        );
    });

    it('does not treat trip_pass as a store product id', () => {
        expect(STORE_PRODUCT_TRIP_PASS).toBe('kupapay_trip_pass');
        expect(findOfferingPackage(packages, 'trip_pass')).toBeNull();
    });
});
