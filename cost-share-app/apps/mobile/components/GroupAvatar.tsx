/**
 * GroupAvatar — cover image, or type-colored tile with emoji / initials fallback.
 */

import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { GroupType } from '@cost-share/shared';
import { getGroupTypeVisual, groupInitialsFromName } from '../lib/groupTypeVisuals';
import { Text } from './AppText';

interface GroupAvatarProps {
    imageUrl?: string | null;
    groupType?: GroupType;
    /** Used for initials fallback when there is no image. */
    name?: string;
    size?: 'sm' | 'md' | 'lg';
    testID?: string;
}

const sizeStyles = {
    sm: { className: 'w-12 h-12 rounded-xl', iconSize: 22, emoji: 22, initials: 'text-sm' },
    md: { className: 'w-14 h-14 rounded-2xl', iconSize: 26, emoji: 26, initials: 'text-base' },
    lg: { className: 'w-24 h-24 rounded-2xl', iconSize: 40, emoji: 40, initials: 'text-xl' },
} as const;

const MAX_AVATAR_RETRIES = 2;

export function GroupAvatar({
    imageUrl,
    groupType = 'general',
    name,
    size = 'sm',
    testID = 'group-avatar',
}: GroupAvatarProps) {
    const { className, emoji, initials } = sizeStyles[size];
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
                    onError={() => setAttempt(a => a + 1)}
                    testID={`${testID}-image`}
                />
            </View>
        );
    }

    const initialsText = name ? groupInitialsFromName(name) : '';

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
                {initialsText.length >= 2 ? (
                    <Text
                        className={`${initials} font-bold text-white`}
                        testID={`${testID}-initials`}
                    >
                        {initialsText}
                    </Text>
                ) : (
                    <Text style={{ fontSize: emoji }} testID={`${testID}-emoji`}>
                        {visual.emoji}
                    </Text>
                )}
            </LinearGradient>
        </View>
    );
}
