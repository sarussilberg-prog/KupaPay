/**
 * ActivityFiltersSheet — unified sort + filter bottom sheet for the activity feed.
 */

import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    Modal,
    Pressable,
    ScrollView,
    Switch,
    TouchableOpacity,
    TextInput,
    Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import {
    ActivityFilters,
    ActivitySortOption,
    ActivityTypeFilter,
    DEFAULT_ACTIVITY_FILTERS,
} from '../lib/activityFilters';
import { getCurrencySymbol } from '../lib/currencyDisplay';

export type { ActivityFilters, ActivitySortOption, ActivityTypeFilter };
export { DEFAULT_ACTIVITY_FILTERS, isAnyActivityFilterActive } from '../lib/activityFilters';

interface GroupOption {
    id: string;
    name: string;
}

interface ActivityFiltersSheetProps {
    visible: boolean;
    filters: ActivityFilters;
    availableCurrencies: string[];
    availableGroups: GroupOption[];
    onApply: (next: ActivityFilters) => void;
    onClose: () => void;
}

function Chip({
    label,
    active,
    onPress,
}: {
    label: string;
    active: boolean;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity
            onPress={onPress}
            className={
                active
                    ? 'px-3 py-1.5 rounded-full bg-primary mr-2 mb-2'
                    : 'px-3 py-1.5 rounded-full bg-gray-100 mr-2 mb-2'
            }
        >
            <Text
                className={
                    active
                        ? 'text-sm font-medium text-white'
                        : 'text-sm font-medium text-gray-700'
                }
            >
                {label}
            </Text>
        </TouchableOpacity>
    );
}

function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function isAllMultiSelected<T>(selected: T[], allValues: T[]): boolean {
    return selected.length === 0 || selected.length === allValues.length;
}

function isMultiItemActive<T>(selected: T[], value: T): boolean {
    return selected.length === 0 || selected.includes(value);
}

function handleMultiToggle<T>(selected: T[], value: T, allValues: T[]): T[] {
    if (selected.length === 0) return [value];
    const next = toggle(selected, value);
    if (next.length === 0 || next.length === allValues.length) return [];
    return next;
}

export function ActivityFiltersSheet({
    visible,
    filters,
    availableCurrencies,
    availableGroups,
    onApply,
    onClose,
}: ActivityFiltersSheetProps) {
    const { t } = useTranslation();
    const [draft, setDraft] = useState<ActivityFilters>(filters);

    useEffect(() => {
        if (visible) setDraft(filters);
    }, [visible, filters]);

    const sortOptions: { key: ActivitySortOption; label: string }[] = [
        { key: 'dateDesc', label: t('activity.sortDateDesc') },
        { key: 'dateAsc', label: t('activity.sortDateAsc') },
        { key: 'amountDesc', label: t('activity.sortAmountDesc') },
        { key: 'amountAsc', label: t('activity.sortAmountAsc') },
    ];

    const typeOptions: { key: ActivityTypeFilter; label: string }[] = [
        { key: 'expense', label: t('activity.expense') },
        { key: 'settlement', label: t('activity.settlement') },
        { key: 'message', label: t('activity.message') },
    ];
    const allTypeKeys = typeOptions.map((opt) => opt.key);
    const allCurrencyCodes = availableCurrencies;
    const allGroupIds = availableGroups.map((g) => g.id);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <Pressable onPress={onClose} className="flex-1 bg-black/40 justify-end">
                <Pressable onPress={() => {}} className="bg-white rounded-t-3xl max-h-[85%]">
                    <View className="px-5 pt-3 pb-2">
                        <View className="self-center w-10 h-1 rounded-full bg-gray-300 mb-3" />
                        <Text className="text-lg font-semibold text-gray-900">
                            {t('activity.filters.title')}
                        </Text>
                        <Text className="text-sm text-gray-500 mt-1">
                            {t('activity.filters.subtitle')}
                        </Text>
                    </View>

                    <ScrollView
                        className="px-5"
                        contentContainerClassName="pb-2"
                        showsVerticalScrollIndicator={false}
                    >
                        <Text className="text-xs font-semibold uppercase text-gray-500 mt-2 mb-2">
                            {t('activity.filters.sort.label')}
                        </Text>
                        <View className="flex-row flex-wrap">
                            {sortOptions.map((opt) => (
                                <Chip
                                    key={opt.key}
                                    label={opt.label}
                                    active={draft.sortBy === opt.key}
                                    onPress={() =>
                                        setDraft((d) => ({ ...d, sortBy: opt.key }))
                                    }
                                />
                            ))}
                        </View>

                        <Text className="text-xs font-semibold uppercase text-gray-500 mt-4 mb-2">
                            {t('activity.filters.types.label')}
                        </Text>
                        <Text className="text-xs text-gray-400 mb-2">
                            {t('activity.filters.types.hint')}
                        </Text>
                        <View className="flex-row flex-wrap">
                            <Chip
                                label={t('activity.filterAll')}
                                active={isAllMultiSelected(draft.types, allTypeKeys)}
                                onPress={() =>
                                    setDraft((d) => ({ ...d, types: [] }))
                                }
                            />
                            {typeOptions.map((opt) => (
                                <Chip
                                    key={opt.key}
                                    label={opt.label}
                                    active={isMultiItemActive(draft.types, opt.key)}
                                    onPress={() =>
                                        setDraft((d) => ({
                                            ...d,
                                            types: handleMultiToggle(
                                                d.types,
                                                opt.key,
                                                allTypeKeys,
                                            ),
                                        }))
                                    }
                                />
                            ))}
                        </View>

                        {availableCurrencies.length > 0 && (
                            <>
                                <Text className="text-xs font-semibold uppercase text-gray-500 mt-4 mb-2">
                                    {t('activity.filters.currency.label')}
                                </Text>
                                <View className="flex-row flex-wrap">
                                    <Chip
                                        label={t('activity.filterAll')}
                                        active={isAllMultiSelected(
                                            draft.currencies,
                                            allCurrencyCodes,
                                        )}
                                        onPress={() =>
                                            setDraft((d) => ({ ...d, currencies: [] }))
                                        }
                                    />
                                    {availableCurrencies.map((c) => (
                                        <Chip
                                            key={c}
                                            label={getCurrencySymbol(c)}
                                            active={isMultiItemActive(
                                                draft.currencies,
                                                c,
                                            )}
                                            onPress={() =>
                                                setDraft((d) => ({
                                                    ...d,
                                                    currencies: handleMultiToggle(
                                                        d.currencies,
                                                        c,
                                                        allCurrencyCodes,
                                                    ),
                                                }))
                                            }
                                        />
                                    ))}
                                </View>
                            </>
                        )}

                        {availableGroups.length > 0 && (
                            <>
                                <Text className="text-xs font-semibold uppercase text-gray-500 mt-4 mb-2">
                                    {t('activity.filters.group.label')}
                                </Text>
                                <View className="flex-row flex-wrap">
                                    <Chip
                                        label={t('activity.filterAll')}
                                        active={isAllMultiSelected(
                                            draft.groupIds,
                                            allGroupIds,
                                        )}
                                        onPress={() =>
                                            setDraft((d) => ({ ...d, groupIds: [] }))
                                        }
                                    />
                                    {availableGroups.map((g) => (
                                        <Chip
                                            key={g.id}
                                            label={g.name}
                                            active={isMultiItemActive(
                                                draft.groupIds,
                                                g.id,
                                            )}
                                            onPress={() =>
                                                setDraft((d) => ({
                                                    ...d,
                                                    groupIds: handleMultiToggle(
                                                        d.groupIds,
                                                        g.id,
                                                        allGroupIds,
                                                    ),
                                                }))
                                            }
                                        />
                                    ))}
                                </View>
                            </>
                        )}

                        <View className="flex-row items-center justify-between mt-5 mb-1">
                            <View className="flex-1 pr-3">
                                <Text className="text-sm font-medium text-gray-700">
                                    {t('activity.filters.onlyMine')}
                                </Text>
                                <Text className="text-xs text-gray-400 mt-0.5">
                                    {t('activity.filters.onlyMineHint')}
                                </Text>
                            </View>
                            <Switch
                                value={draft.onlyMine}
                                onValueChange={(v) =>
                                    setDraft((d) => ({ ...d, onlyMine: v }))
                                }
                            />
                        </View>

                        <Text className="text-xs font-semibold uppercase text-gray-500 mt-4 mb-2">
                            {t('groups.filters.dateRange.label')}
                        </Text>
                        <View className="flex-row" style={{ gap: 8 }}>
                            <View className="flex-1">
                                <Text className="text-xs text-gray-500 mb-1">
                                    {t('groups.filters.dateRange.from')}
                                </Text>
                                <TextInput
                                    value={draft.dateFrom ?? ''}
                                    onChangeText={(v) =>
                                        setDraft((d) => ({
                                            ...d,
                                            dateFrom: v || undefined,
                                        }))
                                    }
                                    placeholder="YYYY-MM-DD"
                                    autoCapitalize="none"
                                    keyboardType={
                                        Platform.OS === 'ios'
                                            ? 'numbers-and-punctuation'
                                            : 'default'
                                    }
                                    className="h-10 rounded-xl bg-gray-100 px-3 text-sm text-gray-900"
                                />
                            </View>
                            <View className="flex-1">
                                <Text className="text-xs text-gray-500 mb-1">
                                    {t('groups.filters.dateRange.to')}
                                </Text>
                                <TextInput
                                    value={draft.dateTo ?? ''}
                                    onChangeText={(v) =>
                                        setDraft((d) => ({
                                            ...d,
                                            dateTo: v || undefined,
                                        }))
                                    }
                                    placeholder="YYYY-MM-DD"
                                    autoCapitalize="none"
                                    keyboardType={
                                        Platform.OS === 'ios'
                                            ? 'numbers-and-punctuation'
                                            : 'default'
                                    }
                                    className="h-10 rounded-xl bg-gray-100 px-3 text-sm text-gray-900"
                                />
                            </View>
                        </View>
                    </ScrollView>

                    <View className="flex-row px-5 pt-3 pb-6 border-t border-gray-100">
                        <TouchableOpacity
                            onPress={() => setDraft(DEFAULT_ACTIVITY_FILTERS)}
                            className="flex-1 mr-2 h-11 rounded-xl bg-gray-100 items-center justify-center"
                        >
                            <Text className="text-sm font-medium text-gray-700">
                                {t('groups.filters.clearAll')}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => {
                                onApply(draft);
                                onClose();
                            }}
                            className="flex-1 ml-2 h-11 rounded-xl bg-primary items-center justify-center"
                        >
                            <Text className="text-sm font-semibold text-white">
                                {t('groups.filters.apply')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}
