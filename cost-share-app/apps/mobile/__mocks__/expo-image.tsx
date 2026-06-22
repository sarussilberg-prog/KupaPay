/**
 * Manual Jest mock for `expo-image`.
 *
 * Renders a plain RN View carrying through all props (testID, onError, source)
 * so tests can locate the image by testID and fire its `error` event. Lives in
 * a module file (not a jest.mock factory) so the NativeWind babel transform can
 * inject its helper at module scope without tripping the out-of-scope rule.
 */
import React from 'react';
import { View } from 'react-native';

type AnyProps = Record<string, unknown> & { children?: React.ReactNode };

export const Image = (props: AnyProps) => <View {...props} />;
export const ImageBackground = (props: AnyProps) => (
    <View {...props}>{props.children}</View>
);

(Image as unknown as { prefetch: jest.Mock }).prefetch = jest.fn(() =>
    Promise.resolve(true),
);
(Image as unknown as { clearDiskCache: jest.Mock }).clearDiskCache = jest.fn(() =>
    Promise.resolve(true),
);
(Image as unknown as { clearMemoryCache: jest.Mock }).clearMemoryCache = jest.fn(
    () => Promise.resolve(true),
);
