import React from 'react';
import { View } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ProPaywallContent } from '../../components/pro/ProPaywallContent';

export function PaywallScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const featureKey = (route.params?.featureKey as string) ?? 'paywall';
    const groupId = route.params?.groupId as string | undefined;
    /** Default on: Trip Pass is a third plan unless a caller opts out explicitly. */
    const showTripPass = route.params?.showTripPass !== false;

    return (
        <View className="flex-1">
            <ProPaywallContent
                featureKey={featureKey}
                groupId={groupId}
                showTripPass={showTripPass}
                onClose={() => navigation.goBack()}
                onPurchaseSuccess={() => navigation.goBack()}
            />
        </View>
    );
}
