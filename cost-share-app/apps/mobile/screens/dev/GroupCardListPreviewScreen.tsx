/**
 * Web-only dev preview: groups list rows for screenshot / visual QA (no auth).
 */

import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { isLanguage, type Language } from '@cost-share/shared';
import {
    buildGroupCardPreviewGroups,
    buildGroupCardPreviewRollups,
} from '../../dev/groupCardPreviewData';
import { GroupCard } from '../../components/GroupCard';
import { Text } from '../../components/AppText';
import { changeLanguage, initializeLanguage } from '../../i18n';
import { useAppStore } from '../../store';

function readLangFromUrl(): Language {
    if (typeof globalThis.location === 'undefined') return 'en';
    const params = new URLSearchParams(globalThis.location.search);
    const raw = params.get('lang');
    return isLanguage(raw) ? raw : 'en';
}

export function GroupCardListPreviewScreen() {
    const [ready, setReady] = useState(false);
    const language = useAppStore(s => s.language);

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
        return <View testID="group-card-preview-root" style={{ flex: 1, backgroundColor: '#f1f5f9' }} />;
    }

    return (
        <View testID="group-card-preview-root" style={{ flex: 1, backgroundColor: '#f1f5f9' }}>
            <View testID="group-card-preview-frame" style={{ flex: 1, paddingTop: 12 }}>
                <Text
                    className="text-xs text-gray-500 px-4 pb-2"
                    style={{ textAlign: 'center' }}
                    testID="group-card-preview-lang"
                >
                    {`GroupCard preview · ${language}`}
                </Text>
                <NavigationContainer>
                    <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24 }}>
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
        </View>
    );
}
