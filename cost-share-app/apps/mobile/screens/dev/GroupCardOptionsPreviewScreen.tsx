/**
 * Web-only: group card design options A/B/C for owner review.
 * Query: ?devGroupCardOptionsPreview=1&lang=he&theme=dark&option=a&stress=1
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { Text } from '../../components/AppText';
import {
    buildGroupCardPreviewGroups,
    buildGroupCardPreviewRollups,
} from '../../dev/groupCardPreviewData';
import {
    applyGroupCardPreviewDocumentTheme,
    readGroupCardPreviewParams,
    type GroupCardDesignOption,
} from '../../dev/groupCardPreviewParams';
import { GroupCardOptionA, GroupCardOptionB, GroupCardOptionC } from '../../dev/groupCardOptions';
import { changeLanguage, initializeLanguage } from '../../i18n';

const OPTION_LABEL: Record<GroupCardDesignOption, string> = {
    a: 'Option A — footer balance',
    b: 'Option B — inline balance',
    c: 'Option C — side panel',
};

function OptionCards({
    option,
    groups,
    rollups,
}: {
    option: GroupCardDesignOption;
    groups: ReturnType<typeof buildGroupCardPreviewGroups>;
    rollups: ReturnType<typeof buildGroupCardPreviewRollups>;
}) {
    const Card =
        option === 'b' ? GroupCardOptionB : option === 'c' ? GroupCardOptionC : GroupCardOptionA;

    return (
        <>
            {groups.map((group, index) => (
                <Card
                    key={group.id}
                    group={group}
                    rollup={rollups[group.id]}
                    groupHasOpenDebts={index === 0}
                    unreadCount={index === 0 ? 3 : 0}
                    onPress={() => {}}
                />
            ))}
        </>
    );
}

export function GroupCardOptionsPreviewScreen() {
    const previewParams = useMemo(() => readGroupCardPreviewParams(), []);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        void (async () => {
            applyGroupCardPreviewDocumentTheme(previewParams.theme);
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

    const surfaceClass = previewParams.theme === 'dark' ? 'bg-gray-900' : 'bg-slate-50';

    if (!ready) {
        return (
            <View testID="group-card-options-preview-root" className={`flex-1 ${surfaceClass}`} />
        );
    }

    return (
        <View testID="group-card-options-preview-root" className={`flex-1 ${surfaceClass}`}>
            <View testID="group-card-options-preview-frame" className="flex-1 pt-3">
                <NavigationContainer>
                    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
                        <Text
                            className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide"
                            testID="group-card-options-preview-label"
                        >
                            {OPTION_LABEL[previewParams.option]}
                        </Text>
                        <OptionCards option={previewParams.option} groups={groups} rollups={rollups} />
                    </ScrollView>
                </NavigationContainer>
            </View>
        </View>
    );
}
