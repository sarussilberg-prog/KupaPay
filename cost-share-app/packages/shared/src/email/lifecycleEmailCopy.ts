import lifecycleCopyJson from '../../content/email/lifecycleCopy.json';
import type { EmailLifecycleTemplateId } from './lifecycleTemplates';

/** Mirror {@link ../i18n/languages#Language} — inlined for Deno edge bundles. */
type Language = 'en' | 'he' | 'ru' | 'ar' | 'fr' | 'es' | 'de';

export type LifecycleEmailCopy = { subject: string; preview: string; bodyHtml: string };

type CopyTable = Record<EmailLifecycleTemplateId, Record<Language, LifecycleEmailCopy>>;

const BY_TEMPLATE = lifecycleCopyJson as CopyTable;

export function lifecycleEmailCopy(
    template: EmailLifecycleTemplateId,
    locale: Language,
): LifecycleEmailCopy {
    const table = BY_TEMPLATE[template];
    return table[locale] ?? table.en;
}
