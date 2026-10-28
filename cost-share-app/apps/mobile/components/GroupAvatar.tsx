/**
 * GroupAvatar — cover image, or type-colored tile with icon / initials fallback.
 */

import React, { useEffect, useState } from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { GroupType } from '@cost-share/shared';
import { getGroupTypeVisual, groupInitialsFromName } from '../lib/groupTypeVisuals';
import { centeredTextStyle } from '../hooks/useRtlLayout';
import { AppIcon } from './AppIcon';
import { Text } from './AppText';

interface GroupAvatarProps {
    imageUrl?: string | null;
    groupType?: GroupType;
    /** Used for initials fallback when there is no image. */
    name?: string;
    size?: 'sm' | 'md' | 'lg';
    testID?: string;
    style?: StyleProp<ViewStyle>;
}

const sizeStyles = {
    sm: { width: 48, height: 48, borderRadius: 12, iconSize: 22, initials: 'text-sm' },
    md: { width: 56, height: 56, borderRadius: 16, iconSize: 26, initials: 'text-base' },
    lg: { width: 96, height: 96, borderRadius: 16, iconSize: 40, initials: 'text-xl' },
} as const;

const MAX_AVATAR_RETRIES = 2;

export function GroupAvatar({
    imageUrl,
    groupType = 'general',
    name,
    size = 'sm',
    testID = 'group-avatar',
    style,
}: GroupAvatarProps) {
    const { width, height, borderRadius, iconSize, initials } = sizeStyles[size];
    const visual = getGroupTypeVisual(groupType);
    const boxStyle: ViewStyle = { width, height, borderRadius, overflow: 'hidden' };

    const [attempt, setAttempt] = useState(0);
    useEffect(() => setAttempt(0), [imageUrl]);

    const showImage = Boolean(imageUrl) && attempt <= MAX_AVATAR_RETRIES;

    if (showImage && imageUrl) {
        return (
            <View style={[boxStyle, style]} testID={testID}>
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
        <View style={[boxStyle, style]} testID={testID}>
            <LinearGradient
                colors={visual.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                    width: '100%',
                    height: '100%',
                    justifyContent: 'center',
                    alignItems: 'center',
                }}
            >
                {initialsText.length >= 2 ? (
                    <Text
                        className={`${initials} font-bold text-white`}
                        testID={`${testID}-initials`}
                        style={{
                            ...centeredTextStyle,
                            ...(Platform.OS === 'android' && { includeFontPadding: false }),
                        }}
                    >
                        {initialsText}
                    </Text>
                ) : (
                    <View
                        testID={`${testID}-icon`}
                        style={{ justifyContent: 'center', alignItems: 'center' }}
                    >
                        <AppIcon
                            name={visual.icon}
                            size={iconSize}
                            color="rgba(255,255,255,0.95)"
                        />
                    </View>
                )}
            </LinearGradient>
        </View>
    );
}
