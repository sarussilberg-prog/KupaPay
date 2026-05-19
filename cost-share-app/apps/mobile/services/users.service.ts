/**
 * Users Service
 * Business logic for user operations
 * ALL user mutations must go through this service
 */

import { User, UpdateProfileDto, ApiResponse } from '@cost-share/shared';
import { apiGet, apiPut } from './api';
import { useAppStore } from '../store';

/**
 * Fetch all users from API
 */
export async function fetchUsers(): Promise<User[]> {
    const response = await apiGet<User[]>('/users');

    if (response.success && response.data) {
        return response.data;
    }

    return [];
}

/**
 * Get user by ID
 */
export async function getUserById(id: string): Promise<User | null> {
    const response = await apiGet<User>(`/users/${id}`);

    if (response.success && response.data) {
        return response.data;
    }

    return null;
}

/**
 * Update user
 * This is the ONLY way to update a user from the UI
 */
export async function updateUser(id: string, dto: UpdateProfileDto): Promise<User | null> {
    const response = await apiPut<User>(`/users/${id}`, dto);

    if (response.success && response.data) {
        // Update current user in store if it's the same user
        const currentUser = useAppStore.getState().currentUser;
        if (currentUser && currentUser.id === id) {
            useAppStore.getState().setCurrentUser(response.data);
        }
        return response.data;
    }

    return null;
}
