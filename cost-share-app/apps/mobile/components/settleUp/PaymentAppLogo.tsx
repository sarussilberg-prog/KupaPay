import { useColorScheme } from 'react-native';
import { View } from 'react-native';
import type { IsraeliPaymentApp } from '../../lib/israeliPaymentLinks';
import { Text } from '../AppText';
import {
    PAYMENT_APP_BRAND,
    PAYMENT_APP_TILE_RADIUS,
    PAYMENT_APP_TILE_SIZE,
} from './paymentAppBrand';

export { PAYMENT_APP_TILE_SIZE } from './paymentAppBrand';

interface PaymentAppLogoProps {
    app: IsraeliPaymentApp;
    size?: number;
    accessibilityLabel: string;
}

export function PaymentAppLogo({
    app,
    size = PAYMENT_APP_TILE_SIZE,
    accessibilityLabel,
}: PaymentAppLogoProps) {
    const scheme = useColorScheme();
    const brand = PAYMENT_APP_BRAND[app];
    const backgroundColor =
        scheme === 'dark' ? brand.backgroundColorDark : brand.backgroundColor;
    const scale = size / PAYMENT_APP_TILE_SIZE;
    const borderRadius = PAYMENT_APP_TILE_RADIUS * scale;
    const fontSize = app === 'paybox' ? 18 * scale : 16 * scale;

    return (
        <View
            testID={`payment-app-logo-${app}`}
            accessibilityRole="image"
            accessibilityLabel={accessibilityLabel}
            style={{
                width: size,
                height: size,
                borderRadius,
                backgroundColor,
                alignItems: 'center',
                justifyContent: 'center',
                padding: 8 * scale,
            }}
        >
            <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                style={{
                    color: '#FFFFFF',
                    fontSize,
                    fontWeight: '800',
                    textAlign: 'center',
                    writingDirection: 'ltr',
                    letterSpacing: app === 'paybox' ? 0.5 : 0,
                }}
            >
                {brand.monogram}
            </Text>
        </View>
    );
}
