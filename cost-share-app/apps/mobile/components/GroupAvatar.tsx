/**
 * GroupAvatar
 * Shows a group image or a type-based icon fallback.
 *
 * Image loading + local caching is delegated to `expo-image` (persistent
 * memory+disk cache keyed by URL: instant on repeat views, available offline
 * once fetched). On load failure we retry a bounded number of times, then fall
 * back to the type gradient/icon so a broken or unreachable URL is never a
 * permanent blank tile.
 */

import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { GroupType } from '@cost-share/shared';
import { getGroupTypeVisual } from '../lib/groupTypeVisuals';
import { AppIcon } from './AppIcon';

interface GroupAvatarProps {
    imageUrl?: string | null;
    groupType?: GroupType;
    size?: 'sm' | 'md' | 'lg';
    testID?: string;
}

const sizeStyles = {
    sm: { className: 'w-12 h-12 rounded-xl', iconSize: 22 },
    md: { className: 'w-16 h-16 rounded-2xl', iconSize: 28 },
    lg: { className: 'w-24 h-24 rounded-2xl', iconSize: 40 },
} as const;

/** How many times to re-attempt a failed cover load before showing the icon. */
const MAX_AVATAR_RETRIES = 2;

export function GroupAvatar({
    imageUrl,
    groupType = 'general',
    size = 'sm',
    testID = 'group-avatar',
}: GroupAvatarProps) {
    const { className, iconSize } = sizeStyles[size];
    const visual = getGroupTypeVisual(groupType);

    const [attempt, setAttempt] = useState(0);
    useEffect(() => setAttempt(0), [imageUrl]);

    const showImage = Boolean(imageUrl) && attempt <= MAX_AVATAR_RETRIES;

    if (showImage && imageUrl) {
        return (
            <View className={`${className} overflow-hidden`} testID={testID}>
                <Image
                    recyclingKey={`${imageUrl}#${attempt}`}
                    source={imageUrl}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={0}
                    onError={() => setAttempt((a) => a + 1)}
                    testID={`${testID}-image`}
                />
            </View>
        );
    }

    return (
        <View className={`${className} overflow-hidden`} testID={testID}>
            <LinearGradient
                colors={visual.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                    flex: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                }}
            >
                <AppIcon
                    name={visual.icon}
                    size={iconSize}
                    color="#FFFFFF"
                    testID={`${testID}-icon`}
                />
            </LinearGradient>
        </View>
    );
}
