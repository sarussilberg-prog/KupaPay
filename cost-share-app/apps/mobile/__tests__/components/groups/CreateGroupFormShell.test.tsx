import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { CreateGroupFormShell, GroupFormSection } from '../../../components/groups/CreateGroupFormShell';

describe('CreateGroupFormShell', () => {
    it('renders section cards and footer content', () => {
        const { getByTestId, getByText } = render(
            <CreateGroupFormShell
                title="groups.createGroup"
                headerStart={<Text>Back</Text>}
                footer={<Text testID="footer-cta">Save</Text>}
                testID="create-group-shell"
            >
                <GroupFormSection title="Section" testID="form-section">
                    <Text>Field</Text>
                </GroupFormSection>
            </CreateGroupFormShell>,
        );

        expect(getByTestId('create-group-shell')).toBeTruthy();
        expect(getByTestId('form-section')).toBeTruthy();
        expect(getByTestId('footer-cta')).toBeTruthy();
        expect(getByText('Field')).toBeTruthy();
    });
});
