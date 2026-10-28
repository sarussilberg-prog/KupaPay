import React from 'react';
import { ScreenErrorBoundary } from '../components/ScreenErrorBoundary';

/**
 * Wraps a navigator screen so render errors show a localized fallback (#427).
 */
export function boundScreen<P extends React.ComponentType<any>>(
    Screen: P,
    screenName: string,
): P {
    const Wrapped = (props: React.ComponentProps<P>) => (
        <ScreenErrorBoundary screenName={screenName}>
            <Screen {...props} />
        </ScreenErrorBoundary>
    );
    Wrapped.displayName = `BoundScreen(${screenName})`;
    return Wrapped as P;
}
