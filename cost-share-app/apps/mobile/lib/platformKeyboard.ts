import { Platform } from 'react-native';

/**
 * KeyboardAvoidingView behavior for native full-screen and modal forms.
 * Android edge-to-edge + resize behaves most reliably with `padding` (same as iOS).
 */
export function nativeKeyboardAvoidingBehavior(): 'padding' | undefined {
    if (Platform.OS === 'web') {
        return undefined;
    }
    return 'padding';
}
