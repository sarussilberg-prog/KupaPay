/**
 * Web-only dev preview: groups list rows for screenshot / visual QA (no auth).
 */

import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { isLanguage, type GroupRollup, type GroupWithMembers, type Language } from '@cost-share/shared';
import { GroupCard } from '../../components/GroupCard';
import { Text } from '../../components/AppText';
import { changeLanguage, initializeLanguage } from '../../i18n';
import { useAppStore } from '../../store';

const rollupOf = (
    primary: { currency: string; net: number },
    others: { currency: string; net: number }[] = [],
): GroupRollup => ({ groupId: 'g1', primary, others });

function buildSampleGroups(): GroupWithMembers[] {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 6 * 86_400_000);
    return [
        {
            id: 'g-trip',
            name: 'דירת שותפים',
            groupType: 'home',
            defaultCurrency: 'ILS',
            inviteToken: 'preview01',
            createdBy: 'u1',
            isActive: true,
            createdAt: weekAgo,
            updatedAt: now,
            lastActivityAt: now,
            members: [
                { userId: 'u1', displayName: 'Noa', isActive: true },
                { userId: 'u2', displayName: 'Yoni', isActive: true },
                { userId: 'u3', displayName: 'Maya', isActive: true },
            ],
            isArchivedByMe: false,
            isAutoArchived: false,
            hasUnreadNote: false,
        },
        {
            id: 'g-multi',
            name: 'Summer trip',
            groupType: 'trip',
            defaultCurrency: 'EUR',
            inviteToken: 'preview02',
            createdBy: 'u1',
            isActive: true,
            createdAt: weekAgo,
            updatedAt: weekAgo,
            lastActivityAt: weekAgo,
            members: [
                { userId: 'u1', displayName: 'Alex', isActive: true },
                { userId: 'u2', displayName: 'Sam', isActive: true },
            ],
            isArchivedByMe: false,
            isAutoArchived: false,
            hasUnreadNote: false,
        },
        {
            id: 'g-settled',
            name: 'Office lunch',
            groupType: 'work',
            defaultCurrency: 'USD',
            inviteToken: 'preview03',
            createdBy: 'u1',
            isActive: true,
            createdAt: weekAgo,
            updatedAt: weekAgo,
            lastActivityAt: weekAgo,
            members: [{ userId: 'u1', displayName: 'Pat', isActive: true }],
            isArchivedByMe: false,
            isAutoArchived: false,
            hasUnreadNote: false,
        },
    ];
}

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

    const groups = buildSampleGroups();
    const rollups: Record<string, GroupRollup> = {
        'g-trip': rollupOf({ currency: 'ILS', net: -761.5 }, [{ currency: 'AFN', net: 138.75 }]),
        'g-multi': rollupOf({ currency: 'EUR', net: 42.5 }, [{ currency: 'USD', net: 30 }]),
        'g-settled': rollupOf({ currency: 'USD', net: 0 }),
    };

    return (
        <View testID="group-card-preview-root" style={{ flex: 1, backgroundColor: '#f1f5f9' }}>
            <View testID="group-card-preview-frame" style={{ flex: 1, paddingTop: 12 }}>
                <Text
                    className="text-xs text-gray-500 px-4 pb-2"
                    style={{ textAlign: 'center' }}
                >
                    {ready ? `GroupCard preview · ${language}` : 'Loading…'}
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
