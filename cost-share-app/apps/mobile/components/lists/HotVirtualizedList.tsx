/**
 * FlashList wrapper for unbounded hot paths (groups, expenses, feeds).
 */

import React, { forwardRef } from 'react';
import { FlashList, FlashListProps, FlashListRef } from '@shopify/flash-list';

export type HotVirtualizedListProps<T> = FlashListProps<T> & {
    /** Regression guard in tests — do not remove from hot screens. */
    testID?: string;
};

function HotVirtualizedListInner<T>(
    { testID = 'hot-virtualized-list', ...rest }: HotVirtualizedListProps<T>,
    ref: React.Ref<FlashListRef<T>>,
) {
    return <FlashList ref={ref} testID={testID} {...rest} />;
}

export const HotVirtualizedList = forwardRef(HotVirtualizedListInner) as <T>(
    props: HotVirtualizedListProps<T> & { ref?: React.Ref<FlashListRef<T>> },
) => React.ReactElement | null;
