import React, { createContext, useContext } from 'react';
import { useWindowDimensions } from 'react-native';

const LayoutWindowWidthContext = createContext<number | null>(null);

export function LayoutWindowWidthProvider({
    width,
    children,
}: {
    width: number;
    children: React.ReactNode;
}) {
    return (
        <LayoutWindowWidthContext.Provider value={width}>
            {children}
        </LayoutWindowWidthContext.Provider>
    );
}

/** Window width for responsive layout; preview mode can override device width. */
export function useLayoutWindowWidth(): number {
    const override = useContext(LayoutWindowWidthContext);
    const { width } = useWindowDimensions();
    return override ?? width;
}
