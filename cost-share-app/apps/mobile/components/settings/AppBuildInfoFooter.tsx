import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { formatAppBuildInfoLines, resolveAppBuildInfo } from '@cost-share/shared';
import { useAppBuildInfoSources } from '../../hooks/useAppBuildInfoSources';

type Props = {
    className?: string;
};

/** Shared settings footer: version, build, commit, environment (mobile + Expo web). */
export function AppBuildInfoFooter({ className }: Props) {
    const sources = useAppBuildInfoSources();
    const lines = useMemo(
        () => formatAppBuildInfoLines(resolveAppBuildInfo(sources)),
        [sources],
    );

    return (
        <View className={className ?? 'mb-8 px-4'}>
            {lines.map(line => (
                <Text key={line} className="text-center text-xs text-gray-400">
                    {line}
                </Text>
            ))}
        </View>
    );
}
