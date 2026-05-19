/**
 * Theme Border Radius
 * Border radius constants for consistent rounded corners
 */

export const borderRadius = {
    none: 0,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    '2xl': 20,
    '3xl': 24,
    full: 9999,
} as const;

export type BorderRadius = typeof borderRadius;
