import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('../../../lib/featureFlags', () => ({
    ...jest.requireActual('../../../lib/featureFlags'),
    E2E_MAESTRO_AUTH_ENABLED: true,
}));

import { GroupsListHeader } from '../../../components/groups/GroupsListHeader';
import { LayoutWindowWidthProvider } from '../../../hooks/useLayoutWindowWidth';

describe('GroupsListHeader create pill layout probe', () => {
    it('exposes groups-create-btn-layout-ok when label fits inside the pill', async () => {
        const { getByTestId } = render(
            <LayoutWindowWidthProvider width={320}>
                <GroupsListHeader
                    searchQuery=""
                    onSearchQueryChange={() => {}}
                    searchExpanded={false}
                    onSearchExpandedChange={() => {}}
                    filterActive={false}
                    onOpenFilters={() => {}}
                    onCreateGroup={() => {}}
                />
            </LayoutWindowWidthProvider>,
        );
        const btn = getByTestId('groups-create-btn');
        fireEvent(btn, 'layout', {
            nativeEvent: { layout: { x: 0, y: 0, width: 120, height: 40 } },
        });
        const label = getByTestId('groups-create-btn-label');
        fireEvent(label, 'layout', {
            nativeEvent: { layout: { x: 28, y: 10, width: 80, height: 16 } },
        });
        await waitFor(() => {
            expect(getByTestId('groups-create-btn-layout-ok', { hidden: true })).toBeTruthy();
        });
    });
});
