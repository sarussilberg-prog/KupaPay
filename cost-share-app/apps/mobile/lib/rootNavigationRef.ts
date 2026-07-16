import { createNavigationContainerRef } from '@react-navigation/native';

/**
 * Shared root navigation ref so exit-guard / deep-link helpers can reach the
 * navigator without prop-drilling through the auth gate.
 */
export const rootNavigationRef = createNavigationContainerRef();
