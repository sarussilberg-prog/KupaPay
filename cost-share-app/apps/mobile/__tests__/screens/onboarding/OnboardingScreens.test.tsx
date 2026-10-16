jest.mock('react-native-reanimated', () => {
    const React = require('react');
    const { View } = require('react-native');
    return {
        __esModule: true,
        default: { createAnimatedComponent: (C: React.ComponentType) => C, View },
    };
});

jest.mock('../../../theme/onboardingMotion', () => ({
    onboardingMotion: {
        fadeUp: () => undefined,
        fadeDown: () => undefined,
    },
}));

jest.mock('../../../components/onboarding/OnboardingHeroImage', () => ({
    OnboardingHeroImage: () => null,
}));

jest.mock('../../../components/onboarding/OnboardingFloatingCard', () => ({
    OnboardingFloatingCard: () => null,
}));

jest.mock('../../../components/onboarding/OnboardingAppMockup', () => ({
    OnboardingAppMockup: () => null,
}));

jest.mock('../../../components/onboarding/OnboardingPagerDots', () => ({
    OnboardingPagerDots: () => null,
}));

import React from 'react';
import { render } from '@testing-library/react-native';
import { OnboardingWelcomeScreen } from '../../../screens/onboarding/OnboardingWelcomeScreen';
import { OnboardingFeatureScreen } from '../../../screens/onboarding/OnboardingFeatureScreen';

describe('Onboarding pre-auth screens', () => {
    it('OnboardingWelcomeScreen exposes start and existing-account CTAs', () => {
        const { getByTestId } = render(
            <OnboardingWelcomeScreen onStart={jest.fn()} onExistingAccount={jest.fn()} />,
        );
        expect(getByTestId('onboarding-welcome-start')).toBeTruthy();
        expect(getByTestId('onboarding-welcome-existing')).toBeTruthy();
    });

    it('OnboardingFeatureScreen exposes pager navigation controls', () => {
        const { getByTestId } = render(
            <OnboardingFeatureScreen
                stepIndex={1}
                eyebrowKey="onboarding.features.step2Eyebrow"
                titleKey="onboarding.features.step2Title"
                mockupHighlight="balances"
                mockupHero="sea"
                onSkip={jest.fn()}
                onBack={jest.fn()}
                onNext={jest.fn()}
            />,
        );
        expect(getByTestId('onboarding-feature-skip')).toBeTruthy();
        expect(getByTestId('onboarding-feature-back')).toBeTruthy();
        expect(getByTestId('onboarding-feature-next')).toBeTruthy();
    });
});
