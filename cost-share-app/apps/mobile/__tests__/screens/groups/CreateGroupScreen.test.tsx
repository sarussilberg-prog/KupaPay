import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockReplace = jest.fn();
let mockRouteParams: Record<string, unknown> = {};
// Captures the latest props the screen passes to the (mocked) AddMembersSheet so
// tests can drive member selection without the real sheet UI.
const mockSheetRef: { current: any } = { current: null };

jest.mock('@react-navigation/native', () => {
    const actual = jest.requireActual('@react-navigation/native');
    return {
        ...actual,
        useNavigation: () => ({
            navigate: mockNavigate,
            goBack: mockGoBack,
            replace: mockReplace,
        }),
        useRoute: () => ({ params: mockRouteParams }),
        useFocusEffect: (cb: () => void) => cb(),
        useIsFocused: () => true,
    };
});

jest.mock('../../../services/groups.service', () => ({
    createGroup: jest.fn(),
    updateGroup: jest.fn(),
    getGroupById: jest.fn(),
    addGroupMember: jest.fn(),
    removeGroupMember: jest.fn(),
}));

jest.mock('../../../services/storage.service', () => ({
    uploadGroupImage: jest.fn(),
}));

jest.mock('expo-image-picker', () => ({
    requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
    launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true }),
    MediaTypeOptions: { Images: 'images' },
}));

jest.mock('../../../services/users.service', () => ({
    fetchUsers: jest.fn().mockResolvedValue([]),
    fetchGroupUsers: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../../services/settlements.service', () => ({
    fetchGroupPairwiseDebts: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../../services/simplifiedDebts.service', () => ({
    fetchSimplifiedInputs: jest.fn().mockResolvedValue({ groups: [] }),
}));

jest.mock('../../../components/AddMembersSheet', () => ({
    AddMembersSheet: (props: any) => {
        mockSheetRef.current = props;
        return null;
    },
}));

// Auto-confirm the "are you sure" removal dialog by firing its destructive action.
jest.mock('../../../lib/platformAlert', () => ({
    platformAlert: jest.fn((_title: string, _msg: unknown, buttons: any[]) => {
        const destructive = (buttons ?? []).find((b) => b.style === 'destructive');
        destructive?.onPress?.();
    }),
}));

import { CreateGroupScreen } from '../../../screens/groups/CreateGroupScreen';
import {
    createGroup,
    updateGroup,
    getGroupById,
    addGroupMember,
    removeGroupMember,
} from '../../../services/groups.service';
import { fetchGroupUsers } from '../../../services/users.service';
import { useAppStore } from '../../../store';

const mockCreateGroup = createGroup as jest.MockedFunction<typeof createGroup>;
const mockUpdateGroup = updateGroup as jest.MockedFunction<typeof updateGroup>;
const mockGetGroupById = getGroupById as jest.MockedFunction<typeof getGroupById>;
const mockAddGroupMember = addGroupMember as jest.MockedFunction<typeof addGroupMember>;
const mockRemoveGroupMember = removeGroupMember as jest.MockedFunction<typeof removeGroupMember>;
const mockFetchGroupUsers = fetchGroupUsers as jest.MockedFunction<typeof fetchGroupUsers>;

beforeEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockReplace.mockClear();
    mockCreateGroup.mockClear();
    mockUpdateGroup.mockClear();
    mockGetGroupById.mockClear();
    mockAddGroupMember.mockClear();
    mockRemoveGroupMember.mockClear();
    mockFetchGroupUsers.mockReset();
    mockFetchGroupUsers.mockResolvedValue([]);
    mockRouteParams = {};
    mockSheetRef.current = null;
    useAppStore.setState({
        currentUser: {
            id: 'u1',
            email: 'a@x.com',
            name: 'Alice',
            inviteToken: 'alice123456',
            defaultCurrency: 'USD',
            language: 'en',
            isActive: true,
            isAdmin: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        },
    });
});

describe('CreateGroupScreen', () => {
    it('renders form fields', async () => {
        const { findByText, queryByText } = render(<CreateGroupScreen />);
        expect(await findByText('groups.groupName')).toBeTruthy();
        expect(await findByText('groups.groupType')).toBeTruthy();
        expect(queryByText('groups.description')).toBeNull();
    });

    it('shows validation error for empty name on submit', async () => {
        const { findAllByText, findByText } = render(<CreateGroupScreen />);
        const buttons = await findAllByText('groups.createGroup');
        fireEvent.press(buttons[buttons.length - 1]);
        expect(await findByText('groups.nameRequired')).toBeTruthy();
        expect(mockCreateGroup).not.toHaveBeenCalled();
    });

    it('calls createGroup with the form data and enters the new group on success', async () => {
        mockCreateGroup.mockResolvedValueOnce({ id: 'g1' } as any);
        const { findAllByText, getByPlaceholderText } = render(<CreateGroupScreen />);
        fireEvent.changeText(
            getByPlaceholderText('groups.createForm.namePlaceholder'),
            'My Group'
        );
        const buttons = await findAllByText('groups.createGroup');
        fireEvent.press(buttons[buttons.length - 1]);
        await waitFor(() => expect(mockCreateGroup).toHaveBeenCalled());
        expect(mockCreateGroup).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'My Group' })
        );
        await waitFor(() =>
            expect(mockNavigate).toHaveBeenCalledWith('Main', {
                screen: 'Groups',
                params: { screen: 'GroupDetail', params: { groupId: 'g1' } },
            })
        );
    });

    describe('edit mode — member additions are staged until Save', () => {
        const renderEdit = async () => {
            mockRouteParams = { groupId: 'g1' };
            mockGetGroupById.mockResolvedValue({
                id: 'g1',
                name: 'Trip',
                groupType: 'general',
                defaultCurrency: 'USD',
                imageUrl: undefined,
            } as any);
            mockUpdateGroup.mockResolvedValue({ id: 'g1' } as any);
            const utils = render(<CreateGroupScreen />);
            // Wait past the initial-loading gate (getGroupById + loadMembers).
            await utils.findByTestId('create-group-screen');
            return utils;
        };

        const stageMember = async () => {
            await waitFor(() => expect(mockSheetRef.current).not.toBeNull());
            await act(async () => {
                mockSheetRef.current.onConfirmSelection([
                    { id: 'u2', isActive: true, name: 'Bob' },
                ]);
            });
        };

        it('does not add the member on selection, only on Save', async () => {
            const { getByTestId } = await renderEdit();
            await stageMember();

            // Selecting must NOT hit the backend.
            expect(mockAddGroupMember).not.toHaveBeenCalled();

            fireEvent.press(getByTestId('create-group-save-header'));

            await waitFor(() =>
                expect(mockAddGroupMember).toHaveBeenCalledWith('g1', 'u2')
            );
            await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
        });

        it('discards the staged member when Cancel is pressed', async () => {
            const { getByTestId } = await renderEdit();
            await stageMember();

            fireEvent.press(getByTestId('create-group-cancel'));

            expect(mockAddGroupMember).not.toHaveBeenCalled();
            expect(mockGoBack).toHaveBeenCalled();
        });
    });

    describe('edit mode — member removals are staged until Save', () => {
        const renderEditWithMember = async () => {
            mockRouteParams = { groupId: 'g1' };
            mockGetGroupById.mockResolvedValue({
                id: 'g1',
                name: 'Trip',
                groupType: 'general',
                defaultCurrency: 'USD',
                imageUrl: undefined,
            } as any);
            mockUpdateGroup.mockResolvedValue({ id: 'g1' } as any);
            mockRemoveGroupMember.mockResolvedValue(true as any);
            mockFetchGroupUsers.mockResolvedValue([
                { id: 'u2', name: 'Bob', email: 'b@x.com', isActive: true },
            ] as any);
            const utils = render(<CreateGroupScreen />);
            // Member row appears once the group + members load.
            await utils.findByTestId('group-form-member-remove-u2');
            return utils;
        };

        it('confirms then stages — removeGroupMember only fires on Save', async () => {
            const { getByTestId, queryByTestId } = await renderEditWithMember();

            // Tapping remove runs the confirm (auto-accepted), which must only stage.
            fireEvent.press(getByTestId('group-form-member-remove-u2'));
            expect(mockRemoveGroupMember).not.toHaveBeenCalled();
            // Row disappears from the list immediately (staged).
            expect(queryByTestId('group-form-member-remove-u2')).toBeNull();

            fireEvent.press(getByTestId('create-group-save-header'));

            await waitFor(() =>
                expect(mockRemoveGroupMember).toHaveBeenCalledWith('g1', 'u2')
            );
            await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
        });

        it('keeps the member when Cancel is pressed after staging removal', async () => {
            const { getByTestId } = await renderEditWithMember();

            fireEvent.press(getByTestId('group-form-member-remove-u2'));
            fireEvent.press(getByTestId('create-group-cancel'));

            expect(mockRemoveGroupMember).not.toHaveBeenCalled();
            expect(mockGoBack).toHaveBeenCalled();
        });
    });
});
