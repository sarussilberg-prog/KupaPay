/**
 * Expenses Service
 * Business logic for expense operations
 * ALL expense mutations must go through this service
 */

import {
    Expense,
    ExpenseSplit,
    CreateExpenseDto,
    UpdateExpenseDto,
    ApiResponse
} from '@cost-share/shared';
import { apiGet, apiPost, apiPut, apiDelete } from './api';
import { useAppStore } from '../store';
import Toast from 'react-native-toast-message';
import i18n from '../i18n';

/**
 * Fetch all expenses from API
 */
export async function fetchExpenses(groupId?: string): Promise<Expense[]> {
    const endpoint = groupId ? `/expenses?groupId=${groupId}` : '/expenses';
    const response = await apiGet<Expense[]>(endpoint);

    if (response.success && response.data) {
        // Update store
        useAppStore.getState().setExpenses(response.data);
        return response.data;
    }

    // Show error toast
    console.error('Failed to fetch expenses:', response.error);
    Toast.show({
        type: 'error',
        text1: i18n.t('history.loadError'),
        text2: response.error || i18n.t('common.networkError'),
    });

    return [];
}

/**
 * Get expense by ID
 */
export async function getExpenseById(id: string): Promise<Expense | null> {
    const response = await apiGet<Expense>(`/expenses/${id}`);

    if (response.success && response.data) {
        return response.data;
    }

    return null;
}

/**
 * Create a new expense with splits
 */
export async function createExpense(dto: CreateExpenseDto): Promise<Expense | null> {
    const response = await apiPost<Expense>('/expenses', dto);

    if (response.success && response.data) {
        // Update store
        useAppStore.getState().addExpense(response.data);

        // Show success toast
        Toast.show({
            type: 'success',
            text1: i18n.t('common.success'),
            text2: i18n.t('expenses.addExpense'),
        });

        return response.data;
    }

    // Show error toast
    console.error('Failed to create expense:', response.error);
    Toast.show({
        type: 'error',
        text1: i18n.t('history.createError'),
        text2: response.error || i18n.t('common.networkError'),
    });

    return null;
}

/**
 * Update an existing expense
 */
export async function updateExpense(id: string, dto: UpdateExpenseDto): Promise<Expense | null> {
    const response = await apiPut<Expense>(`/expenses/${id}`, dto);

    if (response.success && response.data) {
        useAppStore.getState().updateExpense(response.data);
        Toast.show({
            type: 'success',
            text1: i18n.t('common.success'),
            text2: 'Expense updated',
        });
        return response.data;
    }

    Toast.show({
        type: 'error',
        text1: 'Failed to update expense',
        text2: response.error || i18n.t('common.networkError'),
    });
    return null;
}

/**
 * Delete an expense (soft delete)
 */
export async function deleteExpense(id: string): Promise<boolean> {
    const response = await apiDelete(`/expenses/${id}`);

    if (response.success) {
        useAppStore.getState().removeExpense(id);
        Toast.show({
            type: 'success',
            text1: 'Expense deleted',
        });
        return true;
    }

    Toast.show({
        type: 'error',
        text1: 'Failed to delete expense',
        text2: response.error || i18n.t('common.networkError'),
    });
    return false;
}

/**
 * Get expense splits
 */
export async function getExpenseSplits(expenseId: string): Promise<ExpenseSplit[]> {
    const response = await apiGet<ExpenseSplit[]>(`/expenses/${expenseId}/splits`);

    if (response.success && response.data) {
        return response.data;
    }

    console.error('Failed to fetch expense splits:', response.error);
    return [];
}

/**
 * Get expense with its splits
 */
export async function getExpenseWithSplits(expenseId: string): Promise<{ expense: Expense; splits: ExpenseSplit[] } | null> {
    const response = await apiGet<{ expense: Expense; splits: ExpenseSplit[] }>(`/expenses/${expenseId}/with-splits`);

    if (response.success && response.data) {
        return response.data;
    }

    console.error('Failed to fetch expense with splits:', response.error);
    return null;
}
