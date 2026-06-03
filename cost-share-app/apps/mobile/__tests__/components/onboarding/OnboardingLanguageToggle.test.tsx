import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('../../../hooks/useChangeAppLanguage', () => ({
    useChangeAppLanguage: jest.fn(() => jest.fn().mockResolvedValue(undefined)),
}));

import { OnboardingLanguageToggle } from '../../../components/onboarding/OnboardingLanguageToggle';
import { useChangeAppLanguage } from '../../../hooks/useChangeAppLanguage';
import { useAppStore } from '../../../store';

const mockUseChangeAppLanguage = useChangeAppLanguage as jest.MockedFunction<
    typeof useChangeAppLanguage
>;

describe('OnboardingLanguageToggle', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useAppStore.setState({ language: 'en' });
        mockUseChangeAppLanguage.mockImplementation(() =>
            jest.fn().mockResolvedValue(undefined),
        );
    });

    it('opens language sheet when pressed', () => {
        const { getByTestId, queryByTestId } = render(<OnboardingLanguageToggle />);
        expect(queryByTestId('onboarding-language-button-picker')).toBeNull();
        fireEvent.press(getByTestId('onboarding-language-button'));
        expect(getByTestId('onboarding-language-button-picker')).toBeTruthy();
    });

    it('calls changeAppLanguage when Hebrew is selected', () => {
        const changeAppLanguage = jest.fn().mockResolvedValue(undefined);
        mockUseChangeAppLanguage.mockReturnValue(changeAppLanguage);

        const { getByTestId, getByText } = render(<OnboardingLanguageToggle />);
        fireEvent.press(getByTestId('onboarding-language-button'));
        fireEvent.press(getByText('profile.hebrew'));
        expect(changeAppLanguage).toHaveBeenCalledWith('he');
    });
});
