import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { ActivationOnboardingScreen } from '../onboarding/ActivationOnboardingScreen';

/** Admin-only preview of post-login first-group onboarding (no flag persistence). */
export function AdminOnboardingPreviewScreen() {
    const navigation = useNavigation<any>();

    return (
        <ActivationOnboardingScreen
            previewMode
            onDone={() => navigation.goBack()}
        />
    );
}
