/**
 * Web-only dev preview for groups list design options (matches active branch layout).
 * Query: ?devGroupsListB2Preview=1&lang=he&theme=light&stress=1
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
    buildGroupCardPreviewGroups,
    buildGroupCardPreviewRollups,
} from '../../dev/groupCardPreviewData';
import {
    applyGroupsListPreviewDocumentTheme,
    readGroupsListPreviewParams,
} from '../../dev/groupsListPreviewParams';
import { GroupCard } from '../../components/GroupCard';
import { GroupsListHandoffHeader } from '../../components/groups/GroupsListHandoffHeader';
import { GroupsListPersistentSearchBar } from '../../components/groups/GroupsListPersistentSearchBar';
import { GroupsListSectionEyebrow } from '../../components/groups/GroupsListSectionEyebrow';
import { GroupsListCreateFab } from '../../components/groups/GroupsListCreateFab';
import { changeLanguage, initializeLanguage } from '../../i18n';

export function GroupsListB2PreviewScreen() {
    const previewParams = useMemo(() => readGroupsListPreviewParams(), []);
    const { t } = useTranslation();
    const [ready, setReady] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const searchInputRef = useRef(null);

    useEffect(() => {
        void (async () => {
            applyGroupsListPreviewDocumentTheme(previewParams.theme);
            await initializeLanguage();
            await changeLanguage(previewParams.lang);
            setReady(true);
        })();
    }, [previewParams.lang, previewParams.theme]);

    const groups = useMemo(
        () => buildGroupCardPreviewGroups({ stress: previewParams.stress }),
        [previewParams.stress],
    );
    const rollups = useMemo(
        () => buildGroupCardPreviewRollups({ stress: previewParams.stress }),
        [previewParams.stress],
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
        <View testID="groups-list-b2-preview-root" className={`flex-1 ${surfaceClass}`}>
            <NavigationContainer>
                <GroupsListHandoffHeader onFocusSearch={() => {}} />
                <GroupsListPersistentSearchBar
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    filterActive
                    onOpenFilters={() => {}}
                    inputRef={searchInputRef}
                />
                <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}>
                    <GroupsListSectionEyebrow
                        label={t('groups.listSection.activeCount', { count: groups.length })}
                    />
                    {groups.map(group => (
                        <GroupCard
                            key={group.id}
                            group={group}
                            rollup={rollups[group.id]}
                            displayCurrency="USD"
                            ratesFromBase={{ USD: 1, AFN: 70, ILS: 3.7, EUR: 0.92 }}
                            onPress={() => {}}
                            showOverflowMenu={false}
                            showTrailingChevron
                        />
                    ))}
                </ScrollView>
                <GroupsListCreateFab onPress={() => {}} bottomInset={76} />
            </NavigationContainer>
        </View>
    );
}
