/**
 * Dev-only harness for settings value-row layout screenshots (web: append ?preview=settings-row).
 * Not registered in production navigation.
 */
import React from 'react';
import { ScrollView, View } from 'react-native';
import { Text } from '../components/AppText';
import { SettingsRow } from '../components/settings/SettingsRow';
import { SettingsSection } from '../components/settings/SettingsSection';
import { ListRow } from '../components/ui/ListRow';
import { IconLabel } from '../components/ui/IconLabel';
import { AppIcon } from '../components/AppIcon';
import { colors } from '../theme';
import { useRtlLayout } from '../hooks/useRtlLayout';

/** Pre-fix layout: expanding label pushed value to the trailing edge. */
function LegacyValueRow({
    label,
    valueText,
}: {
    label: string;
    valueText: string;
}) {
    const isRtl = useRtlLayout();
    return (
        <ListRow onPress={() => {}} testID="legacy-value-row">
            <IconLabel
                iconName="globe-outline"
                iconColor={colors.gray500}
                label={label}
                labelClassName="text-base text-gray-900"
            />
            <Text className="text-sm text-gray-500 shrink-0">{valueText}</Text>
            <AppIcon name={isRtl ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.gray400} />
        </ListRow>
    );
}

const COPY = {
    he: {
        languageLabel: 'שפה',
        languageValue: 'עברית',
        currencyLabel: 'מטבע ברירת מחדל',
        currencyValue: 'ILS - שקל חדש',
        suffix: 'Hebrew RTL',
    },
    en: {
        languageLabel: 'Language',
        languageValue: 'English',
        currencyLabel: 'Default currency',
        currencyValue: 'USD - US Dollar',
        suffix: 'English LTR',
    },
} as const;

type PreviewLang = keyof typeof COPY;

export function SettingsRowLayoutPreview({ lang }: { lang: PreviewLang }) {
    const copy = COPY[lang] ?? COPY.he;
    return (
        <ScrollView className="flex-1 bg-gray-100">
            <View className="p-4 gap-6">
                <SettingsSection title={`After (fixed) — ${copy.suffix}`}>
                    <SettingsRow
                        iconName="globe-outline"
                        label={copy.languageLabel}
                        variant="value"
                        valueText={copy.languageValue}
                        onPress={() => {}}
                    />
                    <SettingsRow
                        iconName="cash-outline"
                        label={copy.currencyLabel}
                        variant="value"
                        valueText={copy.currencyValue}
                        onPress={() => {}}
                    />
                </SettingsSection>
                <SettingsSection title={`Before (bug) — ${copy.suffix}`}>
                    <LegacyValueRow label={copy.languageLabel} valueText={copy.languageValue} />
                    <LegacyValueRow label={copy.currencyLabel} valueText={copy.currencyValue} />
                </SettingsSection>
            </View>
        </ScrollView>
    );
}
