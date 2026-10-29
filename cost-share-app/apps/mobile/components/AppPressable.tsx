import React from 'react';
import {
    Platform,
    Pressable,
    type PressableProps,
    type PressableAndroidRippleConfig,
} from 'react-native';
import { androidRippleBorderless } from '../lib/androidRipple';

type AppPressableProps = PressableProps & {
    androidRipple?: PressableAndroidRippleConfig | null;
};

/**
 * Pressable with Android ripple feedback; iOS/web unchanged (opacity via pressed state).
 */
export function AppPressable({
    androidRipple = androidRippleBorderless,
    style,
    disabled,
    ...rest
}: AppPressableProps) {
    return (
        <Pressable
            {...rest}
            disabled={disabled}
            android_ripple={
                Platform.OS === 'android' && androidRipple && !disabled ? androidRipple : undefined
            }
            style={state =>
                typeof style === 'function'
                    ? style(state)
                    : [state.pressed && Platform.OS !== 'android' ? { opacity: 0.7 } : null, style]
            }
        />
    );
}
