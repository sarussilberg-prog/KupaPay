import React from 'react';
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { APP_VERSION } from '@cost-share/shared';
import type { AppClientConfig } from '../services/appClientConfig.service';

type Props = {
    config: AppClientConfig;
};

export function UpdateRequiredScreen({ config }: Props) {
    const { t } = useTranslation();

    const openStore = () => {
        const url =
            Platform.OS === 'ios'
                ? config.iosStoreUrl
                : Platform.OS === 'android'
                  ? config.androidStoreUrl
                  : config.iosStoreUrl;
        void Linking.openURL(url);
    };

    return (
        <View className="flex-1 bg-white px-6 justify-center items-center">
            <Text className="text-2xl font-bold text-gray-900 text-center mb-3">
                {t('updateRequired.title')}
            </Text>
            <Text className="text-base text-gray-600 text-center leading-6 mb-2">
                {t('updateRequired.body')}
            </Text>
            <Text className="text-sm text-gray-500 text-center mb-8">
                {t('updateRequired.versionLine', {
                    current: APP_VERSION,
                    required: config.minSupportedVersion,
                })}
            </Text>
            <Pressable
                onPress={openStore}
                className="bg-primary rounded-2xl py-4 px-8 w-full max-w-sm items-center"
                accessibilityRole="button"
            >
                <Text className="text-white text-base font-semibold">{t('updateRequired.cta')}</Text>
            </Pressable>
        </View>
    );
}
