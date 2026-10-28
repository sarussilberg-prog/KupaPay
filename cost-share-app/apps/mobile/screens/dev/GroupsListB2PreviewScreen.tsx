/**
 * Web-only dev preview: groups list mockup B2 (header + summary + cards).
 * Query: ?devGroupsListB2Preview=1&lang=he&theme=dark&narrow=1&stress=1
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { syncGroupsListPreviewDimensions } from '../../dev/syncGroupsListPreviewDimensions';
import { NavigationContainer } from '@react-navigation/native';
import type { BalanceSummary } from '@cost-share/shared';
import { deriveProfileBalanceSummary } from '../../hooks/useProfileBalanceSummary';
import {
    buildGroupCardPreviewGroups,
    buildGroupCardPreviewRollups,
} from '../../dev/groupCardPreviewData';
import {
    applyGroupsListPreviewDocumentTheme,
    readGroupsListPreviewParams,
} from '../../dev/groupsListPreviewParams';
import { GroupCard } from '../../components/GroupCard';
import { GroupsListHeader } from '../../components/groups/GroupsListHeader';
import { GroupsListSummaryCard } from '../../components/groups/GroupsListSummaryCard';
import { changeLanguage, initializeLanguage } from '../../i18n';

function buildMockSummary(stress: boolean): BalanceSummary {
    if (stress) {
        return {
            totalOwed: 12_345.67,
            totalOwedToUser: 98_765.43,
            defaultCurrency: 'USD',
            byCurrency: [
                { currency: 'USD', owed: 12_345.67, owedToUser: 98_765.43 },
                { currency: 'AFN', owed: 0, owedToUser: 138_750.25 },
                { currency: 'ILS', owed: 500, owedToUser: 0 },
            ],
        };
    }
    return {
        totalOwed: 12,
        totalOwedToUser: 54.5,
        defaultCurrency: 'USD',
        byCurrency: [
            { currency: 'USD', owed: 12, owedToUser: 54.5 },
            { currency: 'AFN', owed: 0, owedToUser: 138.75 },
        ],
    };
}

export function GroupsListB2PreviewScreen() {
    const previewParams = useMemo(() => readGroupsListPreviewParams(), []);
    const [ready, setReady] = useState(false);
    const [searchExpanded, setSearchExpanded] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        syncGroupsListPreviewDimensions(previewParams.viewportWidth);
    }, [previewParams.viewportWidth]);

    useEffect(() => {
        void (async () => {
            applyGroupsListPreviewDocumentTheme(previewParams.theme);
            await initializeLanguage();
            await changeLanguage(previewParams.lang);
            syncGroupsListPreviewDimensions(previewParams.viewportWidth);
            setReady(true);
        })();
    }, [previewParams.lang, previewParams.theme, previewParams.viewportWidth]);

    const groups = useMemo(
        () => buildGroupCardPreviewGroups({ stress: previewParams.stress }),
        [previewParams.stress],
    );
    const rollups = useMemo(
        () => buildGroupCardPreviewRollups({ stress: previewParams.stress }),
        [previewParams.stress],
    );
    const mockSummary = useMemo(() => {
        const raw = buildMockSummary(previewParams.stress);
        const rates = { USD: 1, AFN: 70, ILS: 3.7, EUR: 0.92 };
        return deriveProfileBalanceSummary(raw, rates).summary ?? raw;
    }, [previewParams.stress]);

    const mockConversion = useMemo(
        () => ({
            isConverted: true,
            ratesDate: '2026-10-01',
            isLoading: false,
            failed: false,
        }),
        [],
    );

    const surfaceClass =
        previewParams.theme === 'dark' ? 'bg-gray-900' : 'bg-slate-50';

    if (!ready) {
        return (
            <View
                testID="groups-list-b2-preview-root"
                className={`flex-1 ${surfaceClass}`}
            />
        );
    }

    return (
        <View
            testID="groups-list-b2-preview-root"
            className={`flex-1 ${surfaceClass} items-center`}
            nativeID={`groups-list-b2-preview-w${previewParams.viewportWidth}`}
        >
            <View style={{ width: previewParams.viewportWidth, maxWidth: '100%', flex: 1 }}>
            <NavigationContainer>
                <GroupsListHeader
                    searchQuery={searchQuery}
                    onSearchQueryChange={setSearchQuery}
                    searchExpanded={searchExpanded}
                    onSearchExpandedChange={setSearchExpanded}
                    filterActive
                    onOpenFilters={() => {}}
                    onCreateGroup={() => {}}
                />
                <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
                    <GroupsListSummaryCard summary={mockSummary} conversion={mockConversion} />
                    {groups.map(group => (
                        <GroupCard
                            key={group.id}
                            group={group}
                            rollup={rollups[group.id]}
                            displayCurrency="USD"
                            ratesFromBase={{ USD: 1, AFN: 70, ILS: 3.7, EUR: 0.92 }}
                            onPress={() => {}}
                        />
                    ))}
                </ScrollView>
            </NavigationContainer>
            </View>
        </View>
    );
}
