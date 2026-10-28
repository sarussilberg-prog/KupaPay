import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { GroupsListHeader } from '../../../components/groups/GroupsListHeader';

describe('GroupsListHeader', () => {
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

    it('renders a labelled create pill and keeps the title on one line', () => {
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
        expect(getByTestId('groups-list-title').props.numberOfLines).toBe(1);
        expect(queryByText('groups.newGroupCta')).toBeNull();
        const label = getByText('groups.createGroup');
        expect(label.props.numberOfLines).toBe(1);
        expect(getByTestId('groups-create-btn').props.accessibilityLabel).toBe('groups.createGroup');
        fireEvent.press(getByTestId('groups-create-btn'));
        expect(onCreate).toHaveBeenCalledTimes(1);
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
