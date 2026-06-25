import { Text } from '../../../components/AppText';
import React from 'react';

import { render } from '@testing-library/react-native';
import { SettingsSection } from '../../../components/settings/SettingsSection';

describe('SettingsSection', () => {
    it('renders title + children', () => {
        const { getByText } = render(<SettingsSection title="General"><Text>Inside</Text></SettingsSection>);
        expect(getByText('General')).toBeTruthy();
        expect(getByText('Inside')).toBeTruthy();
    });

    it('renders a footer node below the card when provided', () => {
        const { getByText } = render(
            <SettingsSection title="General" footer={<Text>Footer hint</Text>}>
                <Text>Inside</Text>
            </SettingsSection>,
        );
        expect(getByText('Footer hint')).toBeTruthy();
    });

    it('renders no footer when footer is omitted', () => {
        const { queryByText } = render(
            <SettingsSection title="General"><Text>Inside</Text></SettingsSection>,
        );
        expect(queryByText('Footer hint')).toBeNull();
    });
});
