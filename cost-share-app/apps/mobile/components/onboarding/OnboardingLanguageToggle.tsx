/**
 * Language picker (globe icon + sheet) for onboarding screens.
 */

import React, { useCallback, useState } from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Language } from '@cost-share/shared';
import { AppIcon } from '../AppIcon';
import { LanguageSheet } from '../settings/LanguageSheet';
import { useChangeAppLanguage } from '../../hooks/useChangeAppLanguage';
import { useAppLanguage } from '../../hooks/useRtlLayout';
import { onboardingColors } from '../../theme/onboardingColors';
import { colors } from '../../theme';

type Variant = 'onDark' | 'onLight' | 'form';

type Props = Readonly<{
    variant?: Variant;
    testID?: string;
    style?: ViewStyle;
}>;

function iconColorForVariant(variant: Variant): string {
    if (variant === 'onDark') return '#FFFFFF';
    if (variant === 'form') return colors.gray700;
    return onboardingColors.blueDeep;
}

export function OnboardingLanguageToggle({
    variant = 'onLight',
    testID = 'onboarding-language-button',
    style,
}: Props) {
    const { t } = useTranslation();
    const language = useAppLanguage();
    const changeAppLanguage = useChangeAppLanguage();
    const [pickerVisible, setPickerVisible] = useState(false);

    const handleSelect = useCallback(
        async (lang: Language) => {
            setPickerVisible(false);
            await changeAppLanguage(lang);
        },
        [changeAppLanguage],
    );

    const iconColor = iconColorForVariant(variant);

    return (
        <>
            <TouchableOpacity
                onPress={() => setPickerVisible(true)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                testID={testID}
                accessibilityLabel={t('settings.language')}
                accessibilityRole="button"
                style={[styles.base, variantStyles[variant], style]}
            >
                <AppIcon name="language-outline" size={22} color={iconColor} />
            </TouchableOpacity>

            <LanguageSheet
                testID={`${testID}-picker`}
                visible={pickerVisible}
                current={language}
                onSelect={handleSelect}
                onClose={() => setPickerVisible(false)}
            />
        </>
    );
}

const styles = StyleSheet.create({
    base: {
        padding: 10,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

const variantStyles = StyleSheet.create({
    onDark: {
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.28)',
    },
    onLight: {
        backgroundColor: onboardingColors.white,
        borderWidth: 1,
        borderColor: onboardingColors.hairline,
    },
    form: {
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.gray200,
    },
});
