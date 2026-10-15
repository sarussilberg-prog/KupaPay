/** Minimal package shape for paywall UI — avoids importing react-native-purchases on web. */

export interface PurchasesPackageLike {
    identifier: string;
    product: {
        identifier: string;
        priceString: string;
        introPrice?: {
            price: number;
            priceString: string;
            periodNumberOfUnits: number;
            periodUnit: string;
        } | null;
    };
}

export interface PaywallPackages {
    monthly: PurchasesPackageLike | null;
    annual: PurchasesPackageLike | null;
    tripPass: PurchasesPackageLike | null;
}
