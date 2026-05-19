/**
 * Settlements Service
 * Business logic for settlement operations (debt payments)
 * ALL settlement mutations must go through this service
 */

import {
    Settlement,
    CreateSettlementDto,
    ApiResponse
} from '@cost-share/shared';
import { apiGet, apiPost } from './api';
import Toast from 'react-native-toast-message';
import i18n from '../i18n';

/**
 * Fetch settlements for a group
 */
export async function fetchSettlements(groupId?: string): Promise<Settlement[]> {
    const endpoint = groupId ? `/settlements?groupId=${groupId}` : '/settlements';
    const response = await apiGet<Settlement[]>(endpoint);

    if (response.success && response.data) {
        return response.data;
    }

    console.error('Failed to fetch settlements:', response.error);
    Toast.show({
        type: 'error',
        text1: 'Failed to load settlements',
        text2: response.error || i18n.t('common.networkError'),
    });

    return [];
}

/**
 * Get settlement by ID
 */
export async function getSettlementById(id: string): Promise<Settlement | null> {
    const response = await apiGet<Settlement>(`/settlements/${id}`);

    if (response.success && response.data) {
        return response.data;
    }

    return null;
}

/**
 * Create a new settlement (record debt payment)
 */
export async function createSettlement(dto: CreateSettlementDto): Promise<Settlement | null> {
    const response = await apiPost<Settlement>('/settlements', dto);

    if (response.success && response.data) {
        Toast.show({
            type: 'success',
            text1: i18n.t('common.success'),
            text2: 'Payment recorded',
        });
        return response.data;
    }

    console.error('Failed to create settlement:', response.error);
    Toast.show({
        type: 'error',
        text1: 'Failed to record payment',
        text2: response.error || i18n.t('common.networkError'),
    });

    return null;
}

/**
 * Get settlements for a specific user
 */
export async function getUserSettlements(userId: string): Promise<Settlement[]> {
    const response = await apiGet<Settlement[]>(`/settlements/user/${userId}`);

    if (response.success && response.data) {
        return response.data;
    }

    console.error('Failed to fetch user settlements:', response.error);
    return [];
}

/**
 * Get settlement history between two users in a group
 */
export async function getSettlementHistory(
    groupId: string,
    userId1: string,
    userId2: string
): Promise<Settlement[]> {
    const response = await apiGet<Settlement[]>(
        `/settlements/history/${groupId}/${userId1}/${userId2}`
    );

    if (response.success && response.data) {
        return response.data;
    }

    console.error('Failed to fetch settlement history:', response.error);
    return [];
}
