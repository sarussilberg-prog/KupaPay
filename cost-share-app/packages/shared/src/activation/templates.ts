import type { ExpenseCategory, GroupType } from '../types';

/** Preset templates for fast first-group onboarding (issue #392). */
export type ActivationTemplateId = 'trip' | 'roommates' | 'event' | 'couple';

export interface ActivationTemplateDefinition {
    id: ActivationTemplateId;
    groupType: GroupType;
    /** i18n key for suggested default group name */
    defaultNameKey: string;
    /** i18n key for first-expense description placeholder */
    defaultExpenseDescriptionKey: string;
    /** Suggested amount (user-editable); currency comes from group */
    suggestedAmount: number;
    expenseCategory: ExpenseCategory;
}

export const ACTIVATION_TEMPLATE_IDS: readonly ActivationTemplateId[] = [
    'trip',
    'roommates',
    'event',
    'couple',
] as const;

export const ACTIVATION_TEMPLATES: Record<
    ActivationTemplateId,
    ActivationTemplateDefinition
> = {
    trip: {
        id: 'trip',
        groupType: 'trip',
        defaultNameKey: 'onboarding.activation.templates.trip.defaultName',
        defaultExpenseDescriptionKey: 'onboarding.activation.templates.trip.defaultExpense',
        suggestedAmount: 48,
        expenseCategory: 'transport',
    },
    roommates: {
        id: 'roommates',
        groupType: 'home',
        defaultNameKey: 'onboarding.activation.templates.roommates.defaultName',
        defaultExpenseDescriptionKey: 'onboarding.activation.templates.roommates.defaultExpense',
        suggestedAmount: 120,
        expenseCategory: 'utilities',
    },
    event: {
        id: 'event',
        groupType: 'event',
        defaultNameKey: 'onboarding.activation.templates.event.defaultName',
        defaultExpenseDescriptionKey: 'onboarding.activation.templates.event.defaultExpense',
        suggestedAmount: 65,
        expenseCategory: 'food',
    },
    couple: {
        id: 'couple',
        groupType: 'couple',
        defaultNameKey: 'onboarding.activation.templates.couple.defaultName',
        defaultExpenseDescriptionKey: 'onboarding.activation.templates.couple.defaultExpense',
        suggestedAmount: 42,
        expenseCategory: 'food',
    },
};

export function getActivationTemplate(
    id: ActivationTemplateId,
): ActivationTemplateDefinition {
    return ACTIVATION_TEMPLATES[id];
}

export function isActivationTemplateId(value: string): value is ActivationTemplateId {
    return (ACTIVATION_TEMPLATE_IDS as readonly string[]).includes(value);
}
