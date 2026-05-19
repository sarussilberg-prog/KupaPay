/**
 * Groups Service
 * Business logic for group operations
 * ALL group mutations must go through this service
 */

import {
    Group,
    GroupMember,
    UserBalance,
    DebtSummary,
    GroupSummary,
    CreateGroupDto,
    UpdateGroupDto,
    ApiResponse
} from '@cost-share/shared';
import { apiGet, apiPost, apiPut, apiDelete } from './api';
import { useAppStore } from '../store';
import Toast from 'react-native-toast-message';
import i18n from '../i18n';

/**
 * Fetch all groups from API
 */
export async function fetchGroups(): Promise<Group[]> {
    const response = await apiGet<Group[]>('/groups');

    if (response.success && response.data) {
        // Update store
        useAppStore.getState().setGroups(response.data);
        return response.data;
    }

    // Show error toast
    console.error('Failed to fetch groups:', response.error);
    Toast.show({
        type: 'error',
        text1: i18n.t('groups.loadError'),
        text2: response.error || i18n.t('common.networkError'),
    });

    return [];
}

/**
 * Get group by ID
 */
export async function getGroupById(id: string): Promise<Group | null> {
    const response = await apiGet<Group>(`/groups/${id}`);

    if (response.success && response.data) {
        return response.data;
    }

    return null;
}

/**
 * Create a new group
 * This is the ONLY way to create a group from the UI
 */
export async function createGroup(dto: CreateGroupDto): Promise<Group | null> {
    const response = await apiPost<Group>('/groups', dto);

    if (response.success && response.data) {
        // Update store
        useAppStore.getState().addGroup(response.data);

        // Show success toast
        Toast.show({
            type: 'success',
            text1: i18n.t('common.success'),
            text2: i18n.t('groups.createGroup'),
        });

        return response.data;
    }

    // Show error toast
    console.error('Failed to create group:', response.error);
    Toast.show({
        type: 'error',
        text1: i18n.t('groups.createError'),
        text2: response.error || i18n.t('common.networkError'),
    });

    return null;
}

/**
 * Update group
 */
export async function updateGroup(id: string, dto: UpdateGroupDto): Promise<Group | null> {
    const response = await apiPut<Group>(`/groups/${id}`, dto);

    if (response.success && response.data) {
        useAppStore.getState().updateGroup(response.data);
        Toast.show({
            type: 'success',
            text1: i18n.t('common.success'),
            text2: 'Group updated',
        });
        return response.data;
    }

    Toast.show({
        type: 'error',
        text1: 'Failed to update group',
        text2: response.error || i18n.t('common.networkError'),
    });
    return null;
}

/**
 * Delete group (soft delete)
 */
export async function deleteGroup(id: string): Promise<boolean> {
    const response = await apiDelete(`/groups/${id}`);

    if (response.success) {
        useAppStore.getState().removeGroup(id);
        Toast.show({
            type: 'success',
            text1: 'Group deleted',
        });
        return true;
    }

    Toast.show({
        type: 'error',
        text1: 'Failed to delete group',
        text2: response.error || i18n.t('common.networkError'),
    });
    return false;
}

/**
 * Get group members
 */
export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
    const response = await apiGet<GroupMember[]>(`/groups/${groupId}/members`);

    if (response.success && response.data) {
        return response.data;
    }

    console.error('Failed to fetch group members:', response.error);
    return [];
}

/**
 * Add member to group
 */
export async function addGroupMember(groupId: string, userId: string): Promise<GroupMember | null> {
    const response = await apiPost<GroupMember>(`/groups/${groupId}/members`, { userId });

    if (response.success && response.data) {
        Toast.show({
            type: 'success',
            text1: 'Member added',
        });
        return response.data;
    }

    Toast.show({
        type: 'error',
        text1: 'Failed to add member',
        text2: response.error || i18n.t('common.networkError'),
    });
    return null;
}

/**
 * Remove member from group
 */
export async function removeGroupMember(groupId: string, userId: string): Promise<boolean> {
    const response = await apiDelete(`/groups/${groupId}/members/${userId}`);

    if (response.success) {
        Toast.show({
            type: 'success',
            text1: 'Member removed',
        });
        return true;
    }

    Toast.show({
        type: 'error',
        text1: 'Failed to remove member',
        text2: response.error || i18n.t('common.networkError'),
    });
    return false;
}

/**
 * Get user balances in group
 */
export async function getGroupBalances(groupId: string, userId?: string): Promise<UserBalance[]> {
    const endpoint = userId
        ? `/groups/${groupId}/balances?userId=${userId}`
        : `/groups/${groupId}/balances`;

    const response = await apiGet<UserBalance[]>(endpoint);

    if (response.success && response.data) {
        return response.data;
    }

    console.error('Failed to fetch balances:', response.error);
    return [];
}

/**
 * Get simplified debts (who owes whom)
 */
export async function getGroupDebts(groupId: string): Promise<DebtSummary[]> {
    const response = await apiGet<DebtSummary[]>(`/groups/${groupId}/debts`);

    if (response.success && response.data) {
        return response.data;
    }

    console.error('Failed to fetch debts:', response.error);
    return [];
}

/**
 * Get group summary statistics
 */
export async function getGroupSummary(groupId: string): Promise<GroupSummary | null> {
    const response = await apiGet<GroupSummary>(`/groups/${groupId}/summary`);

    if (response.success && response.data) {
        return response.data;
    }

    console.error('Failed to fetch group summary:', response.error);
    return null;
}
