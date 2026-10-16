import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
    ACTIVATION_ONBOARDING_STEPS,
    type ActivationOnboardingStep,
    activationStepIndex,
} from '@cost-share/shared';
import { Text } from '../AppText';
import { onboardingColors } from '../../theme/onboardingColors';
import { rtlTextClassName, useRtlLayout } from '../../hooks/useRtlLayout';

type Props = {
    current: ActivationOnboardingStep;
    testID?: string;
};

const STEP_LABEL_KEYS: Record<ActivationOnboardingStep, string> = {
    create: 'onboarding.activation.steps.create',
    expense: 'onboarding.activation.steps.expense',
    invite: 'onboarding.activation.steps.invite',
};

export function ActivationStepIndicator({ current, testID }: Props) {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();
    const currentIdx = activationStepIndex(current);

    return (
        <View
            testID={testID ?? 'activation-step-indicator'}
            className="flex-row items-center justify-center gap-2 mb-4 px-1"
            accessibilityRole="progressbar"
            accessibilityValue={{
                min: 0,
                max: ACTIVATION_ONBOARDING_STEPS.length,
                now: currentIdx + 1,
            }}
        >
            {ACTIVATION_ONBOARDING_STEPS.map((step, idx) => {
                const done = idx < currentIdx;
                const active = idx === currentIdx;
                const dotColor = done
                    ? onboardingColors.greenInk
                    : active
                      ? onboardingColors.blue
                      : onboardingColors.hairline;
                return (
                    <View key={step} className="flex-1 items-center" testID={`activation-step-dot-${step}`}>
                        <View
                            style={{
                                height: 4,
                                width: '100%',
                                borderRadius: 999,
                                backgroundColor: dotColor,
                            }}
                        />
                        <Text
                            className={rtlTextClassName(
                                isRtl,
                                `text-[10px] font-semibold mt-1 ${active ? '' : 'opacity-60'}`,
                            )}
                            style={{ color: active ? onboardingColors.blueDeep : onboardingColors.muted }}
                            numberOfLines={1}
                        >
                            {t(STEP_LABEL_KEYS[step])}
                        </Text>
                    </View>
                );
            })}
        </View>
    );
}
