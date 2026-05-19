/**
 * useLoading Hook
 * Provides independent loading state for each screen/component
 * Replaces global loading state to prevent conflicts between screens
 */

import { useState } from 'react';

interface UseLoadingReturn {
    isLoading: boolean;
    startLoading: () => void;
    stopLoading: () => void;
    setLoading: (loading: boolean) => void;
}

/**
 * Custom hook for managing loading states
 * Each component that uses this hook gets its own independent loading state
 * 
 * @returns {UseLoadingReturn} Loading state and control functions
 * 
 * @example
 * ```typescript
 * const { isLoading, startLoading, stopLoading } = useLoading();
 * 
 * const loadData = async () => {
 *   startLoading();
 *   await fetchGroups();
 *   stopLoading();
 * };
 * ```
 */
export function useLoading(): UseLoadingReturn {
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const startLoading = (): void => {
        setIsLoading(true);
    };

    const stopLoading = (): void => {
        setIsLoading(false);
    };

    const setLoading = (loading: boolean): void => {
        setIsLoading(loading);
    };

    return {
        isLoading,
        startLoading,
        stopLoading,
        setLoading,
    };
}
