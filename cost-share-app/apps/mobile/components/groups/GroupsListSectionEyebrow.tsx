/**
 * Uppercase section label above a groups list block.
 */

import React from 'react';
import { View } from 'react-native';
import { Text } from '../AppText';
import { useRtlLayout, rtlTextAlign } from '../../hooks/useRtlLayout';

interface GroupsListSectionEyebrowProps {
    label: string;
    testID?: string;
}

export function GroupsListSectionEyebrow({ label, testID }: GroupsListSectionEyebrowProps) {
    const isRtl = useRtlLayout();
    const align = rtlTextAlign(isRtl);

    return (
        <View className="px-1 pb-2 pt-1" testID={testID}>
            <Text
                className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500"
                style={{ textAlign: align, writingDirection: isRtl ? 'rtl' : 'ltr' }}
            >
                {label}
            </Text>
        </View>
    );
}
