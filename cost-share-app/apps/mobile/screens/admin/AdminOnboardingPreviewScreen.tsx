import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { OnboardingCreateGroupScreen } from '../onboarding/OnboardingCreateGroupScreen';

/** Admin-only preview of post-login first-group onboarding (no flag persistence). */
export function AdminOnboardingPreviewScreen() {
    const navigation = useNavigation<any>();

    return (
        <OnboardingCreateGroupScreen
            previewMode
            onDone={() => navigation.goBack()}
        />
    );
}
