/**
 * MemberAvatar Component
 * User avatar with fallback initials
 * Uses NativeWind styling only
 */

import React from 'react';
import { View, Text, Image } from 'react-native';

type AvatarSize = 'sm' | 'md' | 'lg';

interface MemberAvatarProps {
    name: string;
    avatarUrl?: string;
    size?: AvatarSize;
}

const sizeClasses: Record<AvatarSize, { container: string; text: string; imageSize: number }> = {
    sm: { container: 'w-8 h-8', text: 'text-xs', imageSize: 32 },
    md: { container: 'w-10 h-10', text: 'text-sm', imageSize: 40 },
    lg: { container: 'w-14 h-14', text: 'text-lg', imageSize: 56 },
};

function getInitials(name: string): string {
    return name
        .split(' ')
        .map((part) => part.charAt(0))
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

export function MemberAvatar({
    name,
    avatarUrl,
    size = 'md',
}: MemberAvatarProps) {
    const styles = sizeClasses[size];

    if (avatarUrl) {
        return (
            <Image
                source={{ uri: avatarUrl }}
                className={`${styles.container} rounded-full`}
                style={{ width: styles.imageSize, height: styles.imageSize, borderRadius: styles.imageSize / 2 }}
            />
        );
    }

    return (
        <View className={`${styles.container} rounded-full bg-primary-extra-light justify-center items-center`}>
            <Text className={`${styles.text} font-semibold text-primary-dark`}>
                {getInitials(name)}
            </Text>
        </View>
    );
}
