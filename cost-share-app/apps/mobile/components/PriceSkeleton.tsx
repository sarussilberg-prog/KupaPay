import React from 'react';
import { View } from 'react-native';

type PriceSkeletonProps = Readonly<{
    testID?: string;
    widthClass?: string;
}>;

/** Placeholder while store prices load — never shows a numeric price. */
export function PriceSkeleton({ testID = 'price-skeleton', widthClass = 'w-16' }: PriceSkeletonProps) {
    return (
        <View
            testID={testID}
            className={`h-5 rounded-md bg-gray-200 ${widthClass}`}
            accessibilityLabel="Loading price"
        />
    );
}
