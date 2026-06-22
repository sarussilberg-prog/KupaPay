/**
 * FeedRowThumbnail — 44×44 thumbnail for activity feed rows.
 * Displays an image (cached + offline via expo-image) or an icon fallback.
 * On image load failure we retry a couple of times, then show the icon so a
 * broken/unreachable receipt URL never leaves a blank tile.
 */

import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { AppIcon, AppIconName } from './AppIcon';
import { colors } from '../theme';

interface FeedRowThumbnailProps {
    imageUrl?: string;
    iconName?: AppIconName;
    iconColor?: string;
    iconBgColor?: string;
    testID?: string;
}

const MAX_RETRIES = 2;

export function FeedRowThumbnail({
    imageUrl,
    iconName,
    iconColor = colors.primaryDark,
    iconBgColor = colors.primaryExtraLight,
    testID,
}: FeedRowThumbnailProps) {
    const [attempt, setAttempt] = useState(0);
    useEffect(() => setAttempt(0), [imageUrl]);

    if (imageUrl && attempt <= MAX_RETRIES) {
        return (
            <Image
                recyclingKey={`${imageUrl}#${attempt}`}
                source={imageUrl}
                cachePolicy="memory-disk"
                transition={0}
                onError={() => setAttempt((a) => a + 1)}
                style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    borderWidth: 1,
                    // slate-100 / design "border.soft"; no matching theme token exists
                    borderColor: '#F1F5F9',
                }}
                contentFit="cover"
                testID={testID ? `${testID}-image` : undefined}
            />
        );
    }
    return (
        <View
            style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                backgroundColor: iconBgColor,
                alignItems: 'center',
                justifyContent: 'center',
            }}
            testID={testID ? `${testID}-icon` : undefined}
        >
            {iconName && <AppIcon name={iconName} size={22} color={iconColor} />}
        </View>
    );
}
