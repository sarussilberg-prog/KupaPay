/** Minimal package shape for paywall UI — avoids importing react-native-purchases on web. */

export interface PurchasesPackageLike {
    identifier: string;
    product: {
        identifier: string;
        priceString: string;
    };
}

export interface PaywallPackages {
    monthly: PurchasesPackageLike | null;
    annual: PurchasesPackageLike | null;
    tripPass: PurchasesPackageLike | null;
}
