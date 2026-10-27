/**
 * Web-only dev preview: groups list rows for screenshot / visual QA (no auth).
 */

import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { isLanguage, type Language } from '@cost-share/shared';
import {
    buildGroupCardHeroPreviewRollups,
    buildGroupCardPreviewGroups,
    buildGroupCardPreviewRollups,
} from '../../dev/groupCardPreviewData';
import { GroupCard } from '../../components/GroupCard';
import { changeLanguage, initializeLanguage } from '../../i18n';

function readPreviewParams(): { lang: Language; hero: boolean } {
    if (typeof globalThis.location === 'undefined') return { lang: 'en', hero: false };
    const params = new URLSearchParams(globalThis.location.search);
    const raw = params.get('lang');
    const lang = isLanguage(raw) ? raw : 'en';
    return { lang, hero: params.get('hero') === '1' };
}

export function GroupCardListPreviewScreen() {
    const previewParams = readPreviewParams();
    const [ready, setReady] = useState(false);

    useEffect(() => {
        void (async () => {
            await initializeLanguage();
            await changeLanguage(previewParams.lang);
            setReady(true);
        })();
    }, [previewParams.lang]);

    const allGroups = buildGroupCardPreviewGroups();
    const groups = previewParams.hero
        ? allGroups.filter(g => g.id === 'g-trip' || g.id === 'g-multi')
        : allGroups;
    const rollups = previewParams.hero
        ? buildGroupCardHeroPreviewRollups()
        : buildGroupCardPreviewRollups();

    if (!ready) {
        return <View testID="group-card-preview-root" style={{ flex: 1, backgroundColor: '#f1f5f9' }} />;
    }

    return (
        <View testID="group-card-preview-root" style={{ flex: 1, backgroundColor: '#f1f5f9' }}>
            <View testID="group-card-preview-frame" style={{ flex: 1, paddingTop: 12 }}>
                <NavigationContainer>
                    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 }}>
                        <View testID={previewParams.hero ? 'group-card-preview-hero' : undefined}>
                            {groups.map(group => (
                                <GroupCard
                                    key={group.id}
                                    group={group}
                                    rollup={rollups[group.id]}
                                    onPress={() => {}}
                                />
                            ))}
                        </View>
                    </ScrollView>
                </NavigationContainer>
            </View>
        </View>
    );
}
