import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { isGroupPassActive } from '@cost-share/shared';
import { Text } from '../AppText';
import { ProBadge } from '../pro/ProBadge';
import { useProStatusQuery } from '../../hooks/queries/useProStatusQuery';
import { useAppLanguage } from '../../hooks/useRtlLayout';

type Props = Readonly<{
    groupId: string;
}>;

/** Active Trip Pass / group Pro window for this group. */
export function GroupProPassBanner({ groupId }: Props) {
    const { t } = useTranslation();
    const language = useAppLanguage();
    const { data: proStatus, hasPro } = useProStatusQuery(groupId);

    const groupPassActive = useMemo(
        () => (proStatus ? isGroupPassActive(proStatus) : false),
        [proStatus],
    );

    const expiryLabel = useMemo(() => {
        const raw = proStatus?.groupPassUntil;
        if (!raw) return null;
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) return null;
        const locale =
            language === 'he'
                ? 'he-IL'
                : language === 'ar'
                  ? 'ar'
                  : language === 'ru'
                    ? 'ru-RU'
                    : language === 'de'
                      ? 'de-DE'
                      : language === 'fr'
                        ? 'fr-FR'
                        : language === 'es'
                          ? 'es-ES'
                          : 'en-US';
        return d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
    }, [language, proStatus?.groupPassUntil]);

    if (!hasPro || !groupPassActive || !expiryLabel) return null;

    return (
        <View
            testID="group-pro-pass-banner"
            className="mx-4 mt-2 rounded-xl bg-indigo-50/80 border border-indigo-100 px-4 py-3 flex-row items-center gap-2"
        >
            <ProBadge compact />
            <View className="flex-1">
                <Text className="text-indigo-950 font-medium text-sm">
                    {t('pro.groupPass.activeTitle')}
                </Text>
                <Text className="text-indigo-800 text-xs mt-0.5">
                    {t('pro.groupPass.activeUntil', { date: expiryLabel })}
                </Text>
            </View>
        </View>
    );
}
