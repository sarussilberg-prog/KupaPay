/**
 * Shared utility functions
 * 
 * Future utilities to implement:
 * - Date formatting helpers
 * - Currency formatting
 * - Validation helpers
 * - String manipulation utilities
 * - Math utilities for expense calculations
 */

export { formatCurrency, formatMoney } from '../i18n/formatMoney';

/**
 * Calculate split amount per person
 * @param totalAmount - Total expense amount
 * @param numberOfPeople - Number of people to split between
 * @returns Amount per person
 */
export function calculateSplitAmount(totalAmount: number, numberOfPeople: number): number {
    if (numberOfPeople === 0) return 0;
    return totalAmount / numberOfPeople;
}

/**
 * Generate a unique ID (simple implementation)
 * In production, use UUID library
 */
export function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
