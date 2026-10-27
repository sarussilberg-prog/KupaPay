/** Deno deploy bundle — JSON import with attribute (Node shared package uses require). */
import lifecycleCopyJson from '../../../packages/shared/content/email/lifecycleCopy.json' with { type: 'json' };
import { isEmailLifecycleTemplateId } from '../../../packages/shared/src/email/lifecycleTemplates.ts';

type Language = 'en' | 'he' | 'ru' | 'ar' | 'fr' | 'es' | 'de';

export type LifecycleEmailCopy = { subject: string; preview: string; bodyHtml: string };

type TemplateId = 'welcome' | 'add_first_expense' | 'invite_friends' | 'inactive_winback';

type CopyTable = Record<TemplateId, Record<Language, LifecycleEmailCopy>>;

const BY_TEMPLATE = lifecycleCopyJson as CopyTable;

export function lifecycleEmailCopy(
    template: string,
    locale: Language,
): LifecycleEmailCopy {
    if (!isEmailLifecycleTemplateId(template)) {
        return BY_TEMPLATE.welcome.en;
    }
    const table = BY_TEMPLATE[template];
    return table[locale] ?? table.en;
}

export { isEmailLifecycleTemplateId };
