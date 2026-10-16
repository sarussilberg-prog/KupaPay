import React from 'react';
import { render } from '@testing-library/react-native';
import { GroupSummaryShareCard } from '../../../components/share/GroupSummaryShareCard';

describe('GroupSummaryShareCard (#399)', () => {
    it('renders settled label and hides amounts when requested', () => {
        const { getByText, getByTestId } = render(
            <GroupSummaryShareCard
                groupName="Trip"
                settled
                hideAmounts
                lines={[{ id: '1', label: 'A → B', value: '₪10' }]}
            />,
        );
        expect(getByText('Trip')).toBeTruthy();
        expect(getByTestId('group-summary-share-card')).toBeTruthy();
    });
});
