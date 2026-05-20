/**
 * FiltersSheet — sort + filter bottom sheet for the groups list.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { FilterBottomSheet } from './filters/FilterBottomSheet';
import { FilterSection } from './filters/FilterSection';
import { FilterSingleChipGrid } from './filters/FilterSingleChipGrid';
import { FilterChipGrid } from './filters/FilterChipGrid';
import { GroupTypeFilterGrid } from './filters/GroupTypeFilterGrid';
import { FilterToggleRow } from './filters/FilterToggleRow';
import {
    DEFAULT_GROUP_LIST_FILTERS,
    GroupListFilters,
    GroupSortOption,
    isAnyGroupListFilterActive,
} from '../lib/groupListQuery';
import { getCurrencySymbol } from '../lib/currencyDisplay';

export type { BalanceState } from '../lib/groupListQuery';
export type Filters = GroupListFilters;
export const DEFAULT_FILTERS = DEFAULT_GROUP_LIST_FILTERS;
export const isAnyFilterActive = isAnyGroupListFilterActive;

interface FiltersSheetProps {
    visible: boolean;
    filters: GroupListFilters;
    availableCurrencies: string[];
    onApply: (next: GroupListFilters) => void;
    onClose: () => void;
}

export function FiltersSheet({
    visible,
    filters,
    availableCurrencies,
    onApply,
    onClose,
}: FiltersSheetProps) {
    const { t } = useTranslation();

    const sortOptions: { key: GroupSortOption; label: string }[] = [
        { key: 'recentDesc', label: t('groups.filters.sort.recentDesc') },
        { key: 'recentAsc', label: t('groups.filters.sort.recentAsc') },
        { key: 'nameAsc', label: t('groups.filters.sort.nameAsc') },
        { key: 'nameDesc', label: t('groups.filters.sort.nameDesc') },
        { key: 'balanceDesc', label: t('groups.filters.sort.balanceDesc') },
        { key: 'balanceAsc', label: t('groups.filters.sort.balanceAsc') },
    ];

    const balanceOptions = [
        { key: 'all' as const, label: t('groups.filters.balance.all') },
        { key: 'owe' as const, label: t('groups.filters.balance.owe') },
        { key: 'owed' as const, label: t('groups.filters.balance.owed') },
        { key: 'settled' as const, label: t('groups.filters.balance.settled') },
    ];

    const currencyOptions = availableCurrencies.map((c) => ({
        key: c,
        label: getCurrencySymbol(c),
    }));

    return (
        <FilterBottomSheet
            visible={visible}
            filters={filters}
            title={t('groups.filters.title')}
            subtitle={t('groups.filters.subtitle')}
            onApply={onApply}
            onClose={onClose}
            onClear={() => DEFAULT_GROUP_LIST_FILTERS}
        >
            {({ draft, setDraft }) => (
                <>
                    <FilterSection
                        first
                        label={t('groups.filters.sort.label')}
                    >
                        <FilterSingleChipGrid
                            value={draft.sortBy}
                            options={sortOptions}
                            onChange={(key) =>
                                setDraft((d) => ({ ...d, sortBy: key }))
                            }
                        />
                    </FilterSection>

                    <FilterSection label={t('groups.filters.balance.label')}>
                        <FilterSingleChipGrid
                            value={draft.balanceState}
                            options={balanceOptions}
                            onChange={(key) =>
                                setDraft((d) => ({ ...d, balanceState: key }))
                            }
                        />
                    </FilterSection>

                    <FilterSection
                        label={t('groups.filters.type.label')}
                        hint={t('groups.filters.type.hint')}
                    >
                        <GroupTypeFilterGrid
                            allLabel={t('groups.filters.balance.all')}
                            selected={draft.types}
                            onChange={(types) =>
                                setDraft((d) => ({ ...d, types }))
                            }
                        />
                    </FilterSection>

                    {availableCurrencies.length > 0 && (
                        <FilterSection label={t('groups.filters.currency.label')}>
                            <FilterChipGrid
                                allLabel={t('groups.filters.balance.all')}
                                selected={draft.currencies}
                                allValues={availableCurrencies}
                                options={currencyOptions}
                                onChange={(currencies) =>
                                    setDraft((d) => ({ ...d, currencies }))
                                }
                            />
                        </FilterSection>
                    )}

                    <FilterSection label={t('groups.filters.status.label')}>
                        <FilterToggleRow
                            label={t('groups.filters.status.includeArchived')}
                            value={draft.includeArchived}
                            onValueChange={(v) =>
                                setDraft((d) => ({ ...d, includeArchived: v }))
                            }
                        />
                    </FilterSection>
                </>
            )}
        </FilterBottomSheet>
    );
}
