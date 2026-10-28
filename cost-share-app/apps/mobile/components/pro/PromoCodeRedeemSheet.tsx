import React, { useCallback, useState } from 'react';
import { Linking, Platform, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BottomSheetShell } from '../BottomSheetShell';
import { Text } from '../AppText';
import { Button } from '../Button';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { redeemKupaPayPromoCode, type PromoRedeemErrorCode } from '../../services/promoCode.service';
import { presentOfferCodeRedemption } from '../../services/purchases.service';
import { googlePlayOfferRedeemUrl, offerRedemptionTarget } from '../../lib/storeOfferRedemption';
import { showAppToast } from '../../lib/appToast';
import { colors } from '../../theme';

export interface PromoCodeRedeemSheetProps {
    visible: boolean;
    onClose: () => void;
    onRedeemSuccess?: () => void;
}

function errorTitleKey(code: PromoRedeemErrorCode): string {
    switch (code) {
        case 'promo_invalid':
            return 'pro.promoCode.errorInvalid';
        case 'promo_inactive':
            return 'pro.promoCode.errorInactive';
        case 'promo_expired':
            return 'pro.promoCode.errorExpired';
        case 'promo_max_uses':
            return 'pro.promoCode.errorMaxUses';
        case 'promo_already_redeemed':
            return 'pro.promoCode.errorAlreadyRedeemed';
        case 'promo_rate_limit_exceeded':
            return 'pro.promoCode.errorRateLimit';
        case 'not_authenticated':
            return 'pro.promoCode.errorAuth';
        default:
            return 'pro.promoCode.errorGeneric';
    }
}

export function PromoCodeRedeemSheet({ visible, onClose, onRedeemSuccess }: Readonly<PromoCodeRedeemSheetProps>) {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);

    const storeTarget = Platform.OS === 'web' ? null : offerRedemptionTarget();

    const handleRedeem = useCallback(async () => {
        if (busy) return;
        setBusy(true);
        const result = await redeemKupaPayPromoCode(code);
        setBusy(false);
        if (result.ok) {
            showAppToast({ type: 'success', titleKey: 'pro.promoCode.success' });
            setCode('');
            onClose();
            onRedeemSuccess?.();
            return;
        }
        showAppToast({ type: 'error', titleKey: errorTitleKey(result.code) });
    }, [busy, code, onClose, onRedeemSuccess]);

    const handleStoreRedeem = useCallback(() => {
        void presentOfferCodeRedemption();
    }, []);

    const handlePlayRedeem = useCallback(() => {
        void Linking.openURL(googlePlayOfferRedeemUrl());
    }, []);

    return (
        <BottomSheetShell
            visible={visible}
            label={t('pro.promoCode.sheetTitle')}
            onClose={onClose}
            onSave={handleRedeem}
            saveDisabled={busy || code.trim().length < 4}
        >
            <View className="px-4 pb-6 gap-4">
                <Text className="text-sm text-gray-600 leading-5">{t('pro.promoCode.kupapayHint')}</Text>
                <TextInput
                    value={code}
                    onChangeText={setCode}
                    placeholder={t('pro.promoCode.inputPlaceholder')}
                    placeholderTextColor={colors.gray400}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    editable={!busy}
                    testID="promo-code-input"
                    className="border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 bg-white"
                    style={{ writingDirection: isRtl ? 'rtl' : 'ltr', textAlign: isRtl ? 'right' : 'left' }}
                />
                {busy ? (
                    <Text className="text-xs text-gray-500 text-center">{t('pro.promoCode.redeeming')}</Text>
                ) : null}

                {storeTarget === 'ios_sheet' ? (
                    <View className="pt-2 border-t border-gray-100 gap-2">
                        <Text className="text-xs font-semibold text-gray-500 uppercase">
                            {t('pro.promoCode.storeSection')}
                        </Text>
                        <Button
                            title={t('pro.paywall.redeemOfferCode')}
                            variant="secondary"
                            onPress={handleStoreRedeem}
                            testID="promo-store-ios-redeem"
                        />
                    </View>
                ) : null}

                {storeTarget === 'android_play_redeem' ? (
                    <View className="pt-2 border-t border-gray-100 gap-2">
                        <Text className="text-xs font-semibold text-gray-500 uppercase">
                            {t('pro.promoCode.storeSection')}
                        </Text>
                        <Button
                            title={t('pro.promoCode.playRedeem')}
                            variant="secondary"
                            onPress={handlePlayRedeem}
                            testID="promo-store-play-redeem"
                        />
                    </View>
                ) : null}
            </View>
        </BottomSheetShell>
    );
}
