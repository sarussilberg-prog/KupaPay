/**
 * Web-only dev preview: groups list mockup B2 (header + summary + cards).
 */

import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { isLanguage, type BalanceSummary, type Language } from '@cost-share/shared';
import {
    buildGroupCardPreviewGroups,
    buildGroupCardPreviewRollups,
} from '../../dev/groupCardPreviewData';
import { GroupCard } from '../../components/GroupCard';
import { GroupsListHeader } from '../../components/groups/GroupsListHeader';
import { GroupsListSummaryCard } from '../../components/groups/GroupsListSummaryCard';
import { changeLanguage, initializeLanguage } from '../../i18n';

function readLangFromUrl(): Language {
    if (typeof globalThis.location === 'undefined') return 'en';
    const params = new URLSearchParams(globalThis.location.search);
    const raw = params.get('lang');
    return isLanguage(raw) ? raw : 'en';
}

const mockSummary: BalanceSummary = {
    totalOwed: 12,
    totalOwedToUser: 54.5,
    defaultCurrency: 'USD',
    byCurrency: [
        { currency: 'USD', owed: 12, owedToUser: 54.5 },
        { currency: 'AFN', owed: 0, owedToUser: 138.75 },
    ],
};

export function GroupsListB2PreviewScreen() {
    const [ready, setReady] = useState(false);
    const [searchExpanded, setSearchExpanded] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        void (async () => {
            await initializeLanguage();
            const lang = readLangFromUrl();
            await changeLanguage(lang);
            setReady(true);
        })();
    }, []);

    const groups = buildGroupCardPreviewGroups();
    const rollups = buildGroupCardPreviewRollups();

    if (!ready) {
        return (
            <View testID="groups-list-b2-preview-root" style={{ flex: 1, backgroundColor: '#f8fafc' }} />
        );
    }

    return (
        <View testID="groups-list-b2-preview-root" style={{ flex: 1, backgroundColor: '#f8fafc' }}>
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
                    <GroupsListSummaryCard summary={mockSummary} />
                    {groups.map(group => (
                        <GroupCard
                            key={group.id}
                            group={group}
                            rollup={rollups[group.id]}
                            onPress={() => {}}
                        />
                    ))}
                </ScrollView>
            </NavigationContainer>
        </View>
    );
}
