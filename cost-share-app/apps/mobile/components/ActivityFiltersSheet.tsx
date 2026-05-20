/**
 * ActivityFiltersSheet — sort + filter bottom sheet for the activity feed.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { FilterBottomSheet } from './filters/FilterBottomSheet';
import { FilterSection } from './filters/FilterSection';
import { FilterSingleChipGrid } from './filters/FilterSingleChipGrid';
import { FilterChipGrid } from './filters/FilterChipGrid';
import { GroupTypeFilterGrid } from './filters/GroupTypeFilterGrid';
import { FilterToggleRow } from './filters/FilterToggleRow';
import { FilterDateRange } from './filters/FilterDateRange';
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

export function ActivityFiltersSheet({
    visible,
    filters,
    availableCurrencies,
    availableGroups,
    onApply,
    onClose,
}: ActivityFiltersSheetProps) {
    const { t } = useTranslation();

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

    const currencyOptions = availableCurrencies.map((c) => ({
        key: c,
        label: getCurrencySymbol(c),
    }));

    const groupOptions = availableGroups.map((g) => ({
        key: g.id,
        label: g.name,
    }));
    const allGroupIds = availableGroups.map((g) => g.id);

    return (
        <FilterBottomSheet
            visible={visible}
            filters={filters}
            title={t('activity.filters.title')}
            subtitle={t('activity.filters.subtitle')}
            onApply={onApply}
            onClose={onClose}
            onClear={() => DEFAULT_ACTIVITY_FILTERS}
        >
            {({ draft, setDraft }) => (
                <>
                    <FilterSection
                        first
                        label={t('activity.filters.sort.label')}
                    >
                        <FilterSingleChipGrid
                            value={draft.sortBy}
                            options={sortOptions}
                            onChange={(key) =>
                                setDraft((d) => ({ ...d, sortBy: key }))
                            }
                        />
                    </FilterSection>

                    <FilterSection
                        label={t('activity.filters.types.label')}
                        hint={t('activity.filters.types.hint')}
                    >
                        <FilterChipGrid
                            allLabel={t('activity.filterAll')}
                            selected={draft.types}
                            allValues={allTypeKeys}
                            options={typeOptions}
                            onChange={(types) =>
                                setDraft((d) => ({ ...d, types }))
                            }
                        />
                    </FilterSection>

                    <FilterSection
                        label={t('groups.filters.type.label')}
                        hint={t('groups.filters.type.hint')}
                    >
                        <GroupTypeFilterGrid
                            allLabel={t('activity.filterAll')}
                            selected={draft.groupTypes}
                            onChange={(groupTypes) =>
                                setDraft((d) => ({ ...d, groupTypes }))
                            }
                        />
                    </FilterSection>

                    {availableCurrencies.length > 0 && (
                        <FilterSection label={t('activity.filters.currency.label')}>
                            <FilterChipGrid
                                allLabel={t('activity.filterAll')}
                                selected={draft.currencies}
                                allValues={availableCurrencies}
                                options={currencyOptions}
                                onChange={(currencies) =>
                                    setDraft((d) => ({ ...d, currencies }))
                                }
                            />
                        </FilterSection>
                    )}

                    {availableGroups.length > 0 && (
                        <FilterSection label={t('activity.filters.group.label')}>
                            <FilterChipGrid
                                allLabel={t('activity.filterAll')}
                                selected={draft.groupIds}
                                allValues={allGroupIds}
                                options={groupOptions}
                                onChange={(groupIds) =>
                                    setDraft((d) => ({ ...d, groupIds }))
                                }
                            />
                        </FilterSection>
                    )}

                    <FilterSection>
                        <FilterToggleRow
                            label={t('activity.filters.onlyMine')}
                            hint={t('activity.filters.onlyMineHint')}
                            value={draft.onlyMine}
                            onValueChange={(v) =>
                                setDraft((d) => ({ ...d, onlyMine: v }))
                            }
                        />
                    </FilterSection>

                    <FilterSection label={t('groups.filters.dateRange.label')}>
                        <FilterDateRange
                            dateFrom={draft.dateFrom}
                            dateTo={draft.dateTo}
                            onChangeFrom={(dateFrom) =>
                                setDraft((d) => ({ ...d, dateFrom }))
                            }
                            onChangeTo={(dateTo) =>
                                setDraft((d) => ({ ...d, dateTo }))
                            }
                        />
                    </FilterSection>
                </>
            )}
        </FilterBottomSheet>
    );
}
