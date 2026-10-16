import type { Language } from '../i18n/languages';

/** Shown at the top of non-English legal markdown (after the title block). */
export const LEGAL_ENGLISH_PREVAILS_NOTE: Record<Language, string> = {
    en: '',
    he: '**הערה:** במקרה של סתירה בין נוסח זה לבין הגרסה באנגלית, הגרסה באנגלית גוברת.',
    ru: '**Примечание:** В случае расхождения между этим переводом и английской версией преимущественную силу имеет английская версия.',
    ar: '**ملاحظة:** عند وجود أي تعارض بين هذه الترجمة والنسخة الإنجليزية، تسود النسخة الإنجليزية.',
    fr: '**Note :** En cas de contradiction entre cette traduction et la version anglaise, la version anglaise prévaut.',
    es: '**Nota:** En caso de conflicto entre esta traducción y la versión en inglés, prevalece la versión en inglés.',
    de: '**Hinweis:** Bei Widersprüchen zwischen dieser Übersetzung und der englischen Fassung ist die englische Fassung maßgeblich.',
};

export function prependEnglishPrevailsNote(markdown: string, locale: Language): string {
    const note = LEGAL_ENGLISH_PREVAILS_NOTE[locale];
    if (!note) return markdown;
    const lines = markdown.split('\n');
    let insertAt = 0;
    while (insertAt < lines.length && (lines[insertAt]?.startsWith('#') || lines[insertAt]?.trim() === '')) {
        insertAt += 1;
    }
    while (
        insertAt < lines.length &&
        lines[insertAt]?.startsWith('**') &&
        (lines[insertAt]?.includes('DRAFT') || lines[insertAt]?.includes('טיוטה'))
    ) {
        insertAt += 1;
    }
    if (insertAt < lines.length && lines[insertAt]?.trim() === '') insertAt += 1;
    lines.splice(insertAt, 0, note, '');
    return lines.join('\n');
}
