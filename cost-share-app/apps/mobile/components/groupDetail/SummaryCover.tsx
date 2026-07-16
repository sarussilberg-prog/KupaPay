/**
 * SummaryCover — top region of GroupSummaryCard.
 * Image OR type-gradient background, scrim, title block (name · type · members),
 * member stack, and the top-bar buttons (back · switcher · menu) overlaid on the cover.
 *
 * #10: share button removed; share lives in the ⋮ overflow menu.
 * #4:  onSwitcherPress when provided shows a compact star+swap button (Favorite tab).
 * #11a: onMembersPress when provided makes the member stack tappable.
 */

import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { ImageBackground } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Group, GroupMemberLite } from '@cost-share/shared';
import { Text } from '../AppText';
import { AppIcon } from '../AppIcon';
import { MemberStack } from './MemberStack';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { getGroupTypeVisual } from '../../lib/groupTypeVisuals';

const COVER_BODY_HEIGHT = 150;
const BUTTON_TOP_OFFSET = 8;

interface SummaryCoverProps {
    group: Group;
    members: GroupMemberLite[];
    topInset: number;
    onBack: () => void;
    showBack?: boolean;
    onMenu: () => void;
    /** When provided (Favorite tab), renders a compact star+swap switcher button. */
    onSwitcherPress?: () => void;
    /** When provided, the member stack becomes tappable to open the members sheet. */
    onMembersPress?: () => void;
}

export function SummaryCover({
    group,
    members,
    topInset,
    onBack,
    showBack = true,
    onMenu,
    onSwitcherPress,
    onMembersPress,
}: SummaryCoverProps) {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();
    const visual = getGroupTypeVisual(group.groupType);
    const typeLabel = t(`groups.types.${group.groupType}`, {
        defaultValue: group.groupType,
    });
    const totalHeight = COVER_BODY_HEIGHT + topInset;

    // Retry a failed cover load a couple of times, then fall back to the type
    // gradient so a broken/unreachable image never leaves a blank cover.
    const [attempt, setAttempt] = useState(0);
    useEffect(() => setAttempt(0), [group.imageUrl]);
    const showCoverImage = Boolean(group.imageUrl) && attempt <= 2;

    const memberStackNode = onMembersPress ? (
        <TouchableOpacity
            onPress={onMembersPress}
            accessibilityRole="button"
            accessibilityLabel={t('groups.members.seeAll')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            testID="cover-members-stack"
        >
            <MemberStack members={members} showAddAvatar />
        </TouchableOpacity>
    ) : (
        <MemberStack members={members} />
    );

    const buttons = (
        <View
            style={{
                position: 'absolute',
                top: topInset + BUTTON_TOP_OFFSET,
                left: 12,
                right: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                zIndex: 20,
                elevation: 20,
            }}
        >
            {showBack ? (
                <TouchableOpacity
                    onPress={onBack}
                    accessibilityRole="button"
                    accessibilityLabel="Back"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    testID="appbar-back"
                    style={styles.circleButton}
                >
                    <AppIcon
                        name={isRtl ? 'chevron-forward' : 'chevron-back'}
                        size={22}
                        color="#fff"
                    />
                </TouchableOpacity>
            ) : (
                <View style={{ width: 40 }} />
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {onSwitcherPress && (
                    <TouchableOpacity
                        onPress={onSwitcherPress}
                        accessibilityRole="button"
                        accessibilityLabel={t('favoriteGroup.switchLabel')}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        testID="appbar-switcher"
                        style={styles.circleButton}
                    >
                        <AppIcon name="star" size={16} color="#FBBF24" />
                        <AppIcon name="swap-horizontal" size={14} color="#fff" />
                    </TouchableOpacity>
                )}
                <TouchableOpacity
                    onPress={onMenu}
                    accessibilityRole="button"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    testID="appbar-menu"
                    style={styles.circleButton}
                >
                    <AppIcon name="ellipsis-vertical" size={20} color="#fff" />
                </TouchableOpacity>
            </View>
        </View>
    );

    const overlay = (
        <>
            <LinearGradient
                pointerEvents="none"
                colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']}
                locations={[0.35, 1]}
                style={StyleSheet.absoluteFill}
            />

            <View style={styles.titleRow}>
                <View style={styles.titleColumn}>
                    <Text
                        numberOfLines={1}
                        className="text-[18px] font-bold text-white"
                        style={styles.titleShadow}
                    >
                        {group.name}
                    </Text>
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            marginTop: 2,
                        }}
                    >
                        <AppIcon
                            name={visual.icon}
                            size={10}
                            color="rgba(255,255,255,0.85)"
                        />
                        <Text
                            numberOfLines={1}
                            className="text-[10px] text-white/80"
                            style={styles.subtitleShadow}
                        >
                            {typeLabel}
                        </Text>
                    </View>
                    <Text
                        numberOfLines={1}
                        className="text-[11px] text-white/90"
                        style={[styles.subtitleShadow, { marginTop: 2 }]}
                    >
                        {t('groups.memberCount', { count: members.length })}
                    </Text>
                </View>
                {memberStackNode}
            </View>

            {buttons}
        </>
    );

    if (showCoverImage && group.imageUrl) {
        return (
            <ImageBackground
                recyclingKey={`${group.imageUrl}#${attempt}`}
                source={group.imageUrl}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={0}
                onError={() => setAttempt((a) => a + 1)}
                style={[styles.cover, { height: totalHeight }]}
                testID="summary-cover-image"
            >
                {overlay}
            </ImageBackground>
        );
    }

    return (
        <LinearGradient
            colors={visual.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.cover, { height: totalHeight }]}
            testID="summary-cover-gradient"
        >
            <View
                style={[
                    styles.centeredIcon,
                    { paddingTop: topInset / 2 },
                ]}
            >
                <AppIcon
                    name={visual.icon}
                    size={72}
                    color="rgba(255,255,255,0.45)"
                />
            </View>
            {overlay}
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    cover: { width: '100%' },
    centeredIcon: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    titleRow: {
        position: 'absolute',
        left: 14,
        right: 14,
        bottom: 10,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 10,
    },
    titleColumn: { flex: 1, minWidth: 0 },
    titleShadow: {
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    subtitleShadow: {
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    circleButton: {
        width: 40,
        height: 40,
        borderRadius: 9999,
        backgroundColor: 'rgba(0,0,0,0.4)',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
});
