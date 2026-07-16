/**
 * GroupSummaryCard — composite hero card for the GroupDetail screen.
 * Composes SummaryCover (with overlaid app-bar buttons), SummaryBalanceStrip,
 * and SummaryFooter inside one flat-top / rounded-bottom card frame that
 * fills the top region of the screen edge-to-edge.
 *
 * #10: onShare removed from cover (share now in ⋮ overflow menu).
 * #4:  onSwitcherPress passes through to SummaryCover for Favorite tab.
 * #11a: onMembersPress passes through to SummaryCover for tappable avatar stack.
 */

import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Group, GroupMemberLite, GroupRollup } from '@cost-share/shared';
import { SummaryCover } from './SummaryCover';
import { SummaryBalanceStrip } from './SummaryBalanceStrip';
import { SummaryFooter } from './SummaryFooter';
import { shadows } from '../../theme';

// Design token "border.card" (#E2E8F0 / slate-200) is not in theme/colors.ts.
const BORDER_CARD = '#E2E8F0';

interface GroupSummaryCardProps {
    group: Group;
    members: GroupMemberLite[];
    /** Undefined ⇒ "all settled" in the strip (unless balanceUnknown). */
    rollup?: GroupRollup;
    /** True when the balance dataset is unavailable (offline, no cache). */
    balanceUnknown?: boolean;
    settlementCount: number;
    onBack: () => void;
    showBack?: boolean;
    onMenu: () => void;
    onOpenBalances: () => void;
    onOpenNote: () => void;
    onOpenSettleUp: () => void;
    noteHasUnread?: boolean;
    /** When provided (Favorite tab), cover shows a compact star+swap switcher button. */
    onSwitcherPress?: () => void;
    /** When provided, the member stack becomes tappable to open the members sheet. */
    onMembersPress?: () => void;
}

export function GroupSummaryCard({
    group,
    members,
    rollup,
    balanceUnknown,
    settlementCount,
    onBack,
    showBack = true,
    onMenu,
    onOpenBalances,
    onOpenNote,
    onOpenSettleUp,
    noteHasUnread,
    onSwitcherPress,
    onMembersPress,
}: GroupSummaryCardProps) {
    const insets = useSafeAreaInsets();
    return (
        <View
            style={[
                {
                    backgroundColor: '#fff',
                    borderColor: BORDER_CARD,
                    borderBottomWidth: 1,
                    borderBottomLeftRadius: 20,
                    borderBottomRightRadius: 20,
                    overflow: 'hidden',
                },
                shadows.sm,
            ]}
        >
            <SummaryCover
                group={group}
                members={members}
                topInset={insets.top}
                onBack={onBack}
                showBack={showBack}
                onMenu={onMenu}
                onSwitcherPress={onSwitcherPress}
                onMembersPress={onMembersPress}
            />
            <SummaryBalanceStrip
                rollup={rollup}
                balanceUnknown={balanceUnknown}
                onPress={onOpenBalances}
                testID="summary-balance-strip"
            />
            <SummaryFooter
                settlementCount={settlementCount}
                onOpenNote={onOpenNote}
                onOpenSettleUp={onOpenSettleUp}
                noteHasUnread={noteHasUnread}
            />
        </View>
    );
}
