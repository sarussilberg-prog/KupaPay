import React from 'react';
import { Text as RNText, TextProps } from 'react-native';
import { resolveAutoTextStyle, rtlTextClassName, useRtlLayout } from '../hooks/useRtlLayout';

export const Text = React.forwardRef<RNText, TextProps>(function AppText(
    { style, className, ...props },
    ref,
) {
    const isRtl = useRtlLayout();
    const rtlClassName = rtlTextClassName(isRtl, className, style);
    const bidiStyle = resolveAutoTextStyle(isRtl, className, style);
    const mergedClassName = [className, rtlClassName].filter(Boolean).join(' ');

    return (
        <RNText
            ref={ref}
            className={mergedClassName || undefined}
            style={[style, bidiStyle]}
            {...props}
        />
    );
});
