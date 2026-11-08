import React, { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../AppText';
import { Button } from '../Button';
import { STORE_PRODUCT_PRO_MONTHLY, STORE_PRODUCT_PRO_YEARLY } from '../../lib/proConstants';
import {
    debugStoreProductPricing,
    fetchPurchasesCustomerInfo,
    isPurchasesConfigured,
} from '../../services/purchases.service';

type DebugPayload = {
    storefront: Awaited<ReturnType<typeof debugStoreProductPricing>>;
    entitlementProductId: string | null;
};

export function AdminStoreProductPriceDebug() {
    const { t } = useTranslation();
    const [payload, setPayload] = useState<DebugPayload | null>(null);
    const [busy, setBusy] = useState(false);

    const run = useCallback(async () => {
        if (!isPurchasesConfigured()) return;
        setBusy(true);
        try {
            const info = await fetchPurchasesCustomerInfo();
            const ent =
                info?.entitlements.active.pro ?? info?.entitlements.all?.pro ?? null;
            const productId =
                typeof ent?.productIdentifier === 'string' && ent.productIdentifier.trim()
                    ? ent.productIdentifier
                    : STORE_PRODUCT_PRO_MONTHLY;
            const pricing = await debugStoreProductPricing(productId, null);
            const yearly = await debugStoreProductPricing(STORE_PRODUCT_PRO_YEARLY, null);
            setPayload({
                entitlementProductId: productId,
                storefront: {
                    ...pricing,
                    products: [...pricing.products, ...yearly.products],
                },
            });
        } finally {
            setBusy(false);
        }
    }, []);

    if (!__DEV__) return null;

    return (
        <View className="px-4 pb-4" testID="admin-store-product-price-debug">
            <Text className="text-xs font-semibold text-slate-500 mb-2">
                {t('admin.storeProductPrice.sectionTitle')}
            </Text>
            <Button
                title={t('admin.storeProductPrice.refresh')}
                onPress={() => void run()}
                loading={busy}
                disabled={busy || !isPurchasesConfigured()}
                variant="secondary"
                testID="admin-store-product-price-refresh"
            />
            {payload ? (
                <ScrollView horizontal className="mt-2">
                    <Text className="text-xs text-slate-700 font-mono">
                        {JSON.stringify(payload, null, 2)}
                    </Text>
                </ScrollView>
            ) : null}
        </View>
    );
}
