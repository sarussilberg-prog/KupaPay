import type { PressableAndroidRippleConfig } from 'react-native';

/** Default Material-style ripple for list rows and neutral surfaces. */
export const androidRippleBorderless: PressableAndroidRippleConfig = {
    color: 'rgba(15, 23, 42, 0.12)',
    borderless: false,
};

/** Ripple tuned for primary-filled buttons (visible on blue backgrounds). */
export const androidRippleOnPrimary: PressableAndroidRippleConfig = {
    color: 'rgba(255, 255, 255, 0.28)',
    borderless: false,
};

/** Ripple for destructive actions. */
export const androidRippleDanger: PressableAndroidRippleConfig = {
    color: 'rgba(239, 68, 68, 0.22)',
    borderless: false,
};
