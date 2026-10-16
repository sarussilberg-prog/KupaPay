import React from 'react';
import { Platform, Pressable, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
    ACTIVATION_TEMPLATE_IDS,
    getActivationTemplate,
    type ActivationTemplateId,
} from '@cost-share/shared';
import { Text } from '../AppText';
import { AppIcon } from '../AppIcon';
import { getGroupTypeVisual } from '../../lib/groupTypeVisuals';
import { onboardingColors } from '../../theme/onboardingColors';
import { rtlTextClassName, useRtlLayout } from '../../hooks/useRtlLayout';

type Props = {
    selectedId: ActivationTemplateId;
    onSelect: (id: ActivationTemplateId) => void;
};

export function ActivationTemplatePicker({ selectedId, onSelect }: Props) {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();
    const { width } = useWindowDimensions();
    const isWideWeb = Platform.OS === 'web' && width >= 720;
    const columns = isWideWeb ? 4 : 2;

    return (
        <View testID="activation-template-picker">
            <Text
                className={rtlTextClassName(isRtl, 'text-sm font-semibold mb-2')}
                style={{ color: onboardingColors.muted }}
            >
                {t('onboarding.activation.templates.label')}
            </Text>
            <View
                style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 10,
                }}
            >
                {ACTIVATION_TEMPLATE_IDS.map((id) => {
                    const def = getActivationTemplate(id);
                    const visual = getGroupTypeVisual(def.groupType);
                    const selected = selectedId === id;
                    const labelKey = `onboarding.activation.templates.${id}.label`;
                    const widthPct = columns === 4 ? '23%' : '48%';
                    return (
                        <Pressable
                            key={id}
                            onPress={() => onSelect(id)}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            testID={`activation-template-${id}`}
                            style={({ pressed }) => ({
                                width: widthPct,
                                minWidth: columns === 4 ? 120 : 140,
                                flexGrow: 1,
                                opacity: pressed ? 0.88 : 1,
                                transform: [{ scale: pressed ? 0.98 : 1 }],
                            })}
                        >
                            <View
                                style={{
                                    borderRadius: 16,
                                    borderWidth: selected ? 2 : 1,
                                    borderColor: selected
                                        ? onboardingColors.blue
                                        : onboardingColors.hairline,
                                    backgroundColor: selected
                                        ? onboardingColors.blueSoft
                                        : '#FFFFFF',
                                    paddingVertical: 14,
                                    paddingHorizontal: 12,
                                    alignItems: 'center',
                                    ...(Platform.OS === 'web'
                                        ? { cursor: 'pointer' as const }
                                        : null),
                                }}
                            >
                                <Text style={{ fontSize: 22, marginBottom: 6 }}>{visual.emoji}</Text>
                                <AppIcon
                                    name={visual.icon}
                                    size={18}
                                    color={selected ? onboardingColors.blueDeep : onboardingColors.muted}
                                />
                                <Text
                                    className={rtlTextClassName(
                                        isRtl,
                                        'text-sm font-bold mt-2 text-center',
                                    )}
                                    style={{
                                        color: selected
                                            ? onboardingColors.blueDeep
                                            : onboardingColors.ink,
                                    }}
                                >
                                    {t(labelKey)}
                                </Text>
                            </View>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}
