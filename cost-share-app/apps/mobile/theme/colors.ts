/**
 * Theme Colors
 * Centralized color definitions for consistent styling
 * Use these constants instead of hardcoded colors
 * 
 * Light blue primary theme — clean, airy, and gentle
 */

export const colors = {
    // Primary Brand Colors (Light Blue Palette)
    primary: '#60A5FA',          // Blue 400 — soft light blue
    primaryDark: '#3B82F6',      // Blue 500 — for pressed/active states
    primaryLight: '#93C5FD',     // Blue 300 — for backgrounds, tints
    primaryExtraLight: '#DBEAFE', // Blue 100 — for subtle highlights, card accents

    // Semantic Colors
    success: '#10B981',      // Green 500
    warning: '#F59E0B',      // Amber 500
    error: '#EF4444',        // Red 500
    info: '#60A5FA',         // Blue 400

    // Neutral Colors
    white: '#FFFFFF',
    black: '#000000',

    // Gray Scale
    gray50: '#F9FAFB',
    gray100: '#F3F4F6',
    gray200: '#E5E7EB',
    gray300: '#D1D5DB',
    gray400: '#9CA3AF',
    gray500: '#6B7280',
    gray600: '#4B5563',
    gray700: '#374151',
    gray800: '#1F2937',
    gray900: '#111827',

    // Background Colors
    background: {
        primary: '#FFFFFF',
        secondary: '#F8FAFC',
        tertiary: '#F3F4F6',
    },

    // Text Colors
    text: {
        primary: '#111827',
        secondary: '#6B7280',
        tertiary: '#9CA3AF',
        inverse: '#FFFFFF',
    },

    // Border Colors
    border: {
        default: '#E5E7EB',
        dark: '#D1D5DB',
        light: '#F3F4F6',
    },
} as const;

// Export type for TypeScript
export type Colors = typeof colors;
