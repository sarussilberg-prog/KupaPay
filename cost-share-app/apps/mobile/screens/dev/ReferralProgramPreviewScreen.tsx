/**
 * Web-only dev preview: referral / invite-friends screen (RTL layout QA).
 * Query: ?devReferralPreview=1&lang=he&width=390
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { readGroupsListPreviewParams } from '../../dev/groupsListPreviewParams';
import { changeLanguage, initializeLanguage } from '../../i18n';
import { ReferralProgramContent } from '../profile/ReferralProgramScreen';

export function ReferralProgramPreviewScreen() {
    const previewParams = useMemo(() => readGroupsListPreviewParams(), []);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        void (async () => {
            await initializeLanguage();
            await changeLanguage(previewParams.lang);
            setReady(true);
        })();
    }, [previewParams.lang]);

    const mockData = useMemo(
        () => ({
            inviteToken: 'preview-token',
            rewardsThisYear: 0,
            annualCap: 12,
            rewards: [] as [],
        }),
        [],
    );

    if (!ready) {
        return <View testID="referral-preview-loading" />;
    }

    return (
        <ScrollView className="flex-1 bg-slate-50" testID="referral-preview-root">
            <ReferralProgramContent
                data={mockData}
                language={previewParams.lang}
                onShare={() => {}}
                onCopy={() => {}}
            />
        </ScrollView>
    );
}
