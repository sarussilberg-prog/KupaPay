/**
 * MemberAvatar Component
 * User avatar with fallback initials.
 *
 * Image loading + local caching is delegated to `expo-image`, which keeps a
 * persistent memory+disk cache keyed by URL: images render instantly on repeat
 * views and stay available offline once they've been fetched (or warmed by
 * `useAvatarPrefetcher`). On load failure we retry a bounded number of times
 * (self-heal a transient blank), then fall back to initials so a broken or
 * unreachable URL is never a permanent blank box.
 */

import { Text } from './AppText';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

interface MemberAvatarProps {
    name: string;
    avatarUrl?: string;
    size?: AvatarSize;
    /** Overrides preset `size` when stacking many members in a tight row. */
    pixelSize?: number;
    testID?: string;
}

const sizeStyles: Record<AvatarSize, { imageSize: number; text: string }> = {
    xs: { imageSize: 32, text: 'text-[10px]' },
    sm: { imageSize: 36, text: 'text-xs' },
    md: { imageSize: 44, text: 'text-sm' },
    lg: { imageSize: 56, text: 'text-lg' },
};

/** How many times to re-attempt a failed avatar load before showing initials. */
const MAX_AVATAR_RETRIES = 2;

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
    pixelSize,
    testID = 'member-avatar',
}: MemberAvatarProps) {
    const preset = sizeStyles[size];
    const imageSize = pixelSize ?? preset.imageSize;
    const initialsFontSize = pixelSize
        ? Math.max(7, Math.round(pixelSize * 0.32))
        : undefined;
    const frameStyle = {
        width: imageSize,
        height: imageSize,
        borderRadius: imageSize / 2,
    };

    // Retry counter, reset whenever the URL changes so a new picture gets a
    // fresh set of attempts.
    const [attempt, setAttempt] = useState(0);
    useEffect(() => setAttempt(0), [avatarUrl]);

    const showImage = Boolean(avatarUrl) && attempt <= MAX_AVATAR_RETRIES;

    if (showImage && avatarUrl) {
        return (
            <View style={frameStyle} className="overflow-hidden shrink-0 bg-slate-100" testID={testID}>
                <Image
                    // `recyclingKey` keys the attempt so each onError forces a
                    // fresh fetch (and a successful one repopulates the disk cache).
                    recyclingKey={`${avatarUrl}#${attempt}`}
                    source={avatarUrl}
                    style={{ width: imageSize, height: imageSize }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={0}
                    onError={() => setAttempt((a) => a + 1)}
                    accessibilityLabel={name}
                    testID={`${testID}-image`}
                />
            </View>
        );
    }

    return (
        <View
            style={[frameStyle, { borderWidth: 1, borderColor: 'rgba(226, 232, 240, 0.8)' }]}
            className="shrink-0 bg-slate-100 justify-center items-center"
            testID={testID}
        >
            <Text
                className={`${pixelSize ? '' : preset.text} font-semibold text-slate-600 text-center`}
                style={{
                    width: '100%',
                    textAlign: 'center',
                    ...(initialsFontSize ? { fontSize: initialsFontSize } : {}),
                }}
            >
                {getInitials(name)}
            </Text>
        </View>
    );
}
