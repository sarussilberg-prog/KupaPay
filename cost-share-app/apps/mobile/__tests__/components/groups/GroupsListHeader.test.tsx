import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { GroupsListHeader } from '../../../components/groups/GroupsListHeader';

const mockUseWindowDimensions = jest.fn(() => ({
    width: 430,
    height: 800,
    scale: 2,
    fontScale: 1,
}));

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
    default: () => mockUseWindowDimensions(),
}));

describe('GroupsListHeader', () => {
    beforeEach(() => {
        mockUseWindowDimensions.mockReturnValue({
            width: 430,
            height: 800,
            scale: 2,
            fontScale: 1,
        });
    });

    it('shows title and action buttons when search is collapsed', () => {
        const { getByTestId } = render(
            <GroupsListHeader
                searchQuery=""
                onSearchQueryChange={() => {}}
                searchExpanded={false}
                onSearchExpandedChange={() => {}}
                filterActive={false}
                onOpenFilters={() => {}}
                onCreateGroup={() => {}}
            />,
        );
        expect(getByTestId('groups-list-title')).toBeTruthy();
        expect(getByTestId('groups-search-btn')).toBeTruthy();
        expect(getByTestId('groups-filter-btn')).toBeTruthy();
        expect(getByTestId('groups-create-btn')).toBeTruthy();
    });

    it('renders a full create label without truncation on wide inline layout', () => {
        const onCreate = jest.fn();
        const { getByTestId, getByText, queryByText } = render(
            <GroupsListHeader
                searchQuery=""
                onSearchQueryChange={() => {}}
                searchExpanded={false}
                onSearchExpandedChange={() => {}}
                filterActive={false}
                onOpenFilters={() => {}}
                onCreateGroup={onCreate}
            />,
        );
        expect(getByTestId('groups-list-header-inline')).toBeTruthy();
        expect(getByTestId('groups-list-title').props.numberOfLines).toBeUndefined();
        expect(queryByText('groups.newGroupCta')).toBeNull();
        expect(getByText('groups.createGroup')).toBeTruthy();
        expect(getByTestId('groups-create-btn-label')).toBeTruthy();
        fireEvent.press(getByTestId('groups-create-btn'));
        expect(onCreate).toHaveBeenCalledTimes(1);
    });

    it('stacks the title above actions on narrow widths with a full create label', () => {
        mockUseWindowDimensions.mockReturnValue({
            width: 320,
            height: 800,
            scale: 2,
            fontScale: 1,
        });
        const { getByTestId, getByText } = render(
            <GroupsListHeader
                searchQuery=""
                onSearchQueryChange={() => {}}
                searchExpanded={false}
                onSearchExpandedChange={() => {}}
                filterActive={false}
                onOpenFilters={() => {}}
                onCreateGroup={() => {}}
            />,
        );
        expect(getByTestId('groups-list-header-stacked')).toBeTruthy();
        expect(getByTestId('groups-list-title').props.numberOfLines).toBeUndefined();
        expect(getByText('groups.createGroup')).toBeTruthy();
    });

    it('expands inline search when the search button is pressed', () => {
        const onExpand = jest.fn();
        const { getByTestId } = render(
            <GroupsListHeader
                searchQuery=""
                onSearchQueryChange={() => {}}
                searchExpanded={false}
                onSearchExpandedChange={onExpand}
                filterActive={false}
                onOpenFilters={() => {}}
                onCreateGroup={() => {}}
            />,
        );
        fireEvent.press(getByTestId('groups-search-btn'));
        expect(onExpand).toHaveBeenCalledWith(true);
    });

    it('renders SearchExpandable when search is expanded', () => {
        const { getByTestId } = render(
            <GroupsListHeader
                searchQuery="trip"
                onSearchQueryChange={() => {}}
                searchExpanded
                onSearchExpandedChange={() => {}}
                filterActive
                onOpenFilters={() => {}}
                onCreateGroup={() => {}}
            />,
        );
        expect(getByTestId('groups-search-input')).toBeTruthy();
        expect(getByTestId('groups-search-cancel')).toBeTruthy();
    });
});
