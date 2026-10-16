/** Transactional lifecycle email template ids (#404). */
export const EMAIL_LIFECYCLE_TEMPLATES = [
    'welcome',
    'add_first_expense',
    'invite_friends',
    'inactive_winback',
] as const;

export type EmailLifecycleTemplateId = (typeof EMAIL_LIFECYCLE_TEMPLATES)[number];

export function isEmailLifecycleTemplateId(value: string): value is EmailLifecycleTemplateId {
    return (EMAIL_LIFECYCLE_TEMPLATES as readonly string[]).includes(value);
}
